# Backend Scaling Plan — Traffic Surge Readiness

## 1. The Problem: Predictable but Brutal Spikes

Attendance systems have one of the most lopsided traffic profiles in enterprise software. Traffic is near-zero for most of the day, then slams into two sharp peaks:

```
Requests/min
    │
 ▲  │       ██                          ██
    │      ████                        ████
    │     ██████                      ██████
    │    ████████                    ████████
    │___█████████___________________█████████___ time
           08:00–09:00               17:00–18:00
           Check-in surge            Check-out surge
```

The write pattern for N employees:
- ~70% of employees check in within a 20-minute window after the "office open" bell
- Check-out is more spread (30–40 min window) but still concentrated

For a company of 1,000 employees, assuming 70% check in within 20 minutes:
- **700 writes in 1,200 seconds = ~0.58 writes/sec on average**
- But distributed as a normal curve → **peak is ~15–25 concurrent requests**

This is not a Google-scale problem. The real risks are:
1. **Connection pool exhaustion** under burst load (the #1 killer)
2. **Race conditions** on the "check if already checked in today" read-before-write
3. **Downstream bottlenecks** (notifications, payroll triggers) slowing down the API response
4. **Read spikes** when everyone refreshes their homepage at the same time (attendance summary)

---

## 2. Database Choice: Is Postgres Good Enough?

### Short answer: Yes — with the right setup around it.

Postgres is the correct database for attendance data. Here is why, and what needs to change.

### Why Postgres fits attendance perfectly

| Property | Why it matters for attendance |
|----------|-------------------------------|
| **ACID transactions** | The "check-in once per day" rule must never be violated — two concurrent requests for the same user must not both succeed |
| **Strong consistency** | Attendance is a legal/payroll record; eventual consistency is unacceptable |
| **Rich querying** | Monthly summaries, date range filters, joins with employees — SQL is the right tool |
| **Row-level locking** | `SELECT … FOR UPDATE` or `INSERT … ON CONFLICT` gives us race-condition-safe check-ins |

### What the current CSV approach gets wrong (at scale)

- **No atomic read-modify-write**: The current code reads all records, checks in-memory, then writes back. Two concurrent check-ins from the same user will race and both succeed.
- **Full file scan on every request**: O(n) reads with no indexing.
- **No connection pooling**: Not applicable for CSV, but critical for Postgres.

### What Postgres needs to perform well at surge

#### a) Enforce uniqueness at the DB level

Replace application-level duplicate checking with a DB constraint:

```sql
-- Ensures one record per user per day, atomically
CREATE UNIQUE INDEX uq_attendance_user_date
  ON attendance (user_id, date);
```

Then the API does a single `INSERT … ON CONFLICT DO NOTHING` — no read-before-write, no race condition possible, no extra round-trip.

#### b) Add targeted indexes

```sql
-- Used by: GET /attendance/summary, GET /admin/attendance
CREATE INDEX idx_attendance_user_id  ON attendance (user_id);
CREATE INDEX idx_attendance_date     ON attendance (date);
CREATE INDEX idx_attendance_user_date ON attendance (user_id, date);
```

Without these, every summary query is a full table scan. With 10,000 employees × 260 working days = 2.6M rows in year 1. Full scans will be felt.

#### c) Connection pooling with PgBouncer

Postgres creates one OS process per connection. Under a morning surge:
- 25 concurrent API requests → 25 DB connections
- Each NestJS instance holds a connection pool → multiply by number of instances
- Without pooling, you hit Postgres's `max_connections` limit fast

**PgBouncer in transaction mode** sits between the app and Postgres, multiplexing hundreds of app connections onto a small number of Postgres connections:

```
NestJS (×N instances)              Postgres
  [pool: 10 conns each]    →    [max_connections: 100]
          ↕
      PgBouncer
  (accepts 1000 app conns,
   maps to 20 Postgres conns)
```

#### d) Consider a Read Replica for reports

Check-in/out writes go to the **primary**. Attendance summary reads (homepage load) go to a **read replica**. During the morning surge, everyone logs in and fetches their summary simultaneously — this offloads that read spike from the write primary.

### Verdict on Postgres

Postgres alone handles the write volume comfortably. The real risks (race conditions, connection exhaustion, read spikes) are all solved by configuration and schema design, not by switching databases.

**Do not use Cassandra or MongoDB for attendance.** Both sacrifice strong consistency, which is the one property attendance data cannot trade away.

---

## 3. Should We Introduce a Message Queue?

### Short answer: Yes — but only for the right jobs.

The key question is: **does the user need to wait for this work to complete before getting a response?**

### What must stay synchronous (no MQ)

The check-in/check-out write path **must remain synchronous and return a result immediately**:

```
User taps "Check In"
       ↓
  API validates + writes to Postgres
       ↓
  Returns { status: "checked_in", time: ... }   ← user sees this instantly
```

If you move the DB write to a queue, the user gets a "we'll process it later" response. They refresh the app, their status hasn't updated, they tap again — duplicate check-in. This is the worst possible outcome for an attendance system. **The core write must be synchronous.**

### What should move to a queue (side effects)

Everything that happens *after* the check-in is confirmed is a perfect candidate for async processing:

| Side effect | Why async? |
|-------------|-----------|
| **Push notification / email** ("You've checked in at 08:32") | Sending an email is slow and can fail; user doesn't need to wait for it |
| **Attendance streak / gamification updates** | Pure reporting; can lag by seconds |
| **Payroll system sync** | External API call; can be slow and unreliable |
| **HR dashboard cache invalidation** | Internal housekeeping |
| **Daily attendance digest** (end-of-day summary to managers) | Scheduled, not real-time |

Without a queue, any of these failures or slowdowns **bubble up to the user's API response time**. A slow payroll API call would make check-in feel sluggish every morning.

### Recommended queue: BullMQ (Redis-backed)

BullMQ runs on Redis (which you'll already have for caching — see section 4). It's the standard NestJS-native solution with `@nestjs/bull`.

```
Check-in request
       ↓
  AttendanceService.checkIn()
    ├─ INSERT into Postgres ✓
    ├─ queue.add('send-notification', { userId, time, location })
    ├─ queue.add('sync-payroll', { userId, date })
    └─ return record to user immediately ← no waiting for queue jobs

  [Worker processes jobs asynchronously]
    ├─ NotificationWorker → send push/email
    └─ PayrollWorker     → POST to payroll API
```

The user gets their response in < 200ms. The side effects process in the background.

### What about queuing the DB write itself?

Some architectures write check-ins to a queue first, flush to DB in batch:

```
User → API → Redis queue → batch flush to Postgres every 5s
```

**Do not do this for attendance.** Problems:
- User gets "accepted" response but the record isn't in Postgres yet
- If the worker crashes before flushing, check-ins are lost
- Complexity with no meaningful gain (Postgres handles the write volume fine)

The only scenario where this pattern makes sense is 100,000+ employees checking in simultaneously. At that scale, you'd have bigger architectural problems to solve first.

---

## 4. Caching Layer: Redis

Redis solves two specific problems in this system:

### Problem 1: Read spike at login time

When the morning surge hits, everyone opens the app and fetches their attendance summary simultaneously. These are reads against Postgres. Add Redis as a short-lived cache:

```
GET /attendance/summary
       ↓
  Redis.get("summary:userId:2026-03")  → cache hit → return immediately
       ↓ (miss)
  Postgres query
       ↓
  Redis.set("summary:userId:2026-03", result, TTL: 60s)
       ↓
  Return result
```

**TTL of 60 seconds** is reasonable: the summary doesn't need to be real-time to the second, and after a check-in the relevant key is invalidated immediately.

### Problem 2: Today's check-in status lookup

The attendance page needs to know: "has this user already checked in today?" Currently this is a DB read. Cache it in Redis:

```
"checkin-status:userId:2026-03-26" → "none" | "checked_in" | "completed"
TTL: until midnight (auto-expires daily)
```

After a successful check-in, update the cache immediately. This removes one DB read from the hot path.

---

## 5. Proposed Architecture

### Current (POC)
```
Client → NestJS → CSV files
```

### After improvements
```
                          ┌─────────────────┐
                          │   Load Balancer  │
                          │  (Nginx / ALB)  │
                          └────────┬────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
        ┌────────────┐      ┌────────────┐      ┌────────────┐
        │  NestJS #1 │      │  NestJS #2 │      │  NestJS #3 │
        │  (API)     │      │  (API)     │      │  (API)     │
        └──────┬─────┘      └──────┬─────┘      └──────┬─────┘
               └──────────────────┬┘──────────────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               ▼                  ▼                  ▼
        ┌─────────────┐   ┌───────────────┐   ┌──────────────┐
        │  PgBouncer  │   │  Redis        │   │  BullMQ      │
        │ (conn pool) │   │  (cache +     │   │  Workers     │
        └──────┬──────┘   │   queue)      │   │  (notif,     │
               │          └───────────────┘   │   payroll)   │
       ┌───────┴──────┐                       └──────────────┘
       ▼              ▼
┌───────────┐  ┌───────────┐
│ Postgres  │  │ Postgres  │
│ (primary) │  │ (replica) │
│  writes   │  │  reads    │
└───────────┘  └───────────┘
```

---

## 6. Implementation Phases

### Phase 1 — Fix the foundations (do this before anything else)
Priority: **Critical**

- [ ] Migrate CSV → Postgres
- [ ] Add `UNIQUE (user_id, date)` constraint + all indexes
- [ ] Rewrite `checkIn` to use `INSERT … ON CONFLICT` (eliminates race condition)
- [ ] Add PgBouncer (or use `pg-pool` configured connection pool in NestJS)
- [ ] Use TypeORM or Prisma for the repository layer

**Impact**: Eliminates data integrity bugs and connection exhaustion. Handles the current load + 10× growth.

---

### Phase 2 — Add Redis caching
Priority: **High** (do before scaling horizontally)

- [ ] Add Redis via `@nestjs/cache-manager` + `cache-manager-redis-store`
- [ ] Cache attendance summary with 60s TTL, invalidate on check-in/out
- [ ] Cache today's check-in status per user (TTL until midnight)
- [ ] Move JWT session validation to Redis if token blacklisting is needed

**Impact**: Offloads read spike from Postgres, improves homepage load time from ~100ms → ~5ms on cache hit.

---

### Phase 3 — Introduce BullMQ for side effects
Priority: **Medium** (when notification/integration features are added)

- [ ] Install `@nestjs/bull`, `bull`, `ioredis`
- [ ] Create `NotificationQueue` — process after check-in/out
- [ ] Create `PayrollSyncQueue` — process at end of day
- [ ] Add queue monitoring (Bull Board UI)

**Impact**: Decouples API response time from third-party integrations. Adds retry + dead-letter handling for free.

---

### Phase 4 — Horizontal scaling
Priority: **Low** (needed only at ~5,000+ employees)

- [ ] Containerize with Docker (backend + worker as separate services)
- [ ] Add Nginx load balancer
- [ ] Add Postgres read replica (point summary queries there)
- [ ] Set up health check endpoint (`GET /health`)

**Impact**: Linear horizontal scalability. Multiple API instances share Redis state safely.

---

---

## 8. The 1 Million Employee Scenario

### First: do the math

At 1M employees, the morning surge is no longer a moderate-traffic problem. It becomes a genuinely hard distributed systems challenge.

Assumptions:
- 70% check in within a 20-minute window → 700,000 writes in 1,200 seconds
- Real-world distribution is not uniform — it peaks sharply around a central minute
- Modelling as a normal distribution with σ = 4 min: the peak 1-minute window absorbs ~10% of traffic

```
Peak write rate  = 700,000 × 10% / 60 seconds
               ≈ 1,167 writes/second (sustained for ~1 min)

Realistic burst  ≈ 1,500–2,500 writes/second
```

Table growth:
```
1M employees × 1 record/day × 260 working days = 260M rows/year
After 3 years                                  = 780M rows
After 5 years                                  = 1.3B rows
```

---

### Can a single Postgres instance handle this?

**Raw write throughput — barely, and with no headroom.**

A well-tuned Postgres instance on NVMe SSD handles roughly:
- Single-row `INSERT` (no indexes): ~10,000–15,000/sec
- Single-row `INSERT` with 2–3 indexes + unique constraint: ~3,000–6,000/sec

At ~2,500 peak writes/sec, a single Postgres primary is operating near its ceiling. Any slow query, vacuum autotrigger, or index bloat during the peak window risks causing write latency to cascade into timeouts. There is no safety margin.

**Table size — Postgres can handle it, but it requires partitioning.**

Postgres does not struggle with 1B rows per se, but query planner performance degrades significantly on unpartitioned tables of that size. Without partitioning:
- A summary query scans a 1.3B-row table with an index → still slow
- Autovacuum runs become increasingly expensive
- Index size alone becomes a memory concern

**Verdict: Postgres alone at 1M employees is survivable but fragile. The write path needs a fundamental rethink.**

---

### What breaks and why

| Problem | Root cause | Why it's worse at 1M |
|---------|-----------|----------------------|
| Write throughput ceiling | Postgres processes writes serially per WAL segment | 2,500 writes/sec is near the single-instance limit |
| Index maintenance overhead | Every INSERT updates all indexes | More rows = larger indexes = slower updates |
| Connection pressure | 1M potential concurrent users | Even PgBouncer strains at this connection count |
| Vacuum / bloat | High write volume generates dead tuples | Autovacuum competes with live writes at peak |
| Table scan cost | 1.3B unpartitioned rows | Even indexed queries become expensive |

---

### The required architectural shift: Write Buffer + Postgres as System of Record

The core insight is: **Postgres doesn't need to absorb 2,500 writes/second individually. It needs to absorb the total daily volume efficiently.**

Instead of writing each check-in to Postgres directly, the write path becomes:

```
Employee checks in
      │
      ▼
  API validates (auth, basic input check)
      │
      ▼
  Redis SET  (immediate — sub-millisecond)
  "checkin:{userId}:{date}" = { time, lat, lng, location }
      │
      ▼
  Return 201 to user  ← response in < 50ms, no Postgres touched
      │
      ▼ (async)
  Redis Stream / Kafka topic  ←  event: "check-in recorded"
      │
      ▼
  Consumer (NestJS worker)
  Batch flush to Postgres every 5 seconds
  using multi-row INSERT:
  INSERT INTO attendance (...) VALUES (...),(...),...
  ON CONFLICT (user_id, date) DO NOTHING
```

**Why this works:**

- Redis handles 100,000+ writes/second easily. The burst is absorbed instantly.
- The consumer writes to Postgres in batches of 500–1,000 rows. A batch insert of 1,000 rows is ~10× more efficient per row than 1,000 individual inserts.
- At 2,500 check-ins/sec, a 5-second batch accumulates ~12,500 rows → one efficient `INSERT` → Postgres processes it in ~200ms.
- Postgres sees a steady, manageable stream of batch writes instead of thousands of individual concurrent connections.

**The tradeoff:** There is a brief window (up to 5 seconds) where the check-in is in Redis but not yet in Postgres. The API must read today's status from Redis first, Postgres second:

```
GET attendance status for today
      │
      ├─ Redis hit → return immediately (fast path, covers the 5s window)
      └─ Redis miss → query Postgres (covers historical / evicted data)
```

This is acceptable because Redis persistence (AOF) guarantees the data survives a Redis restart. The data is not lost — it's just not in Postgres for a few seconds.

---

### Table partitioning: mandatory at this scale

Without partitioning, a 1.3B-row table is operationally dangerous. With **range partitioning by month**, Postgres maintains separate physical files per partition:

```sql
CREATE TABLE attendance (
    id          UUID NOT NULL,
    user_id     UUID NOT NULL,
    date        DATE NOT NULL,
    ...
) PARTITION BY RANGE (date);

CREATE TABLE attendance_2026_03
    PARTITION OF attendance
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE attendance_2026_04
    PARTITION OF attendance
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- etc.
```

Benefits:
- Queries for "this month's summary" touch only one partition (millions of rows, not billions)
- Old partitions can be archived or dropped instantly (no DELETE overhead)
- Autovacuum runs per partition, not the whole table
- Index size per partition is manageable

Use **TimescaleDB** (a Postgres extension) to automate this. It handles partition creation, compression of old chunks, and query routing transparently — no manual partition management needed.

---

### Does the uniqueness constraint still work?

The `UNIQUE (user_id, date)` constraint is critical for data integrity. With partitioning and a write buffer, it requires care:

- **Within Postgres**: the unique constraint is enforced per partition in Postgres 12+ when the partition key is included. Since `date` is the partition key, `UNIQUE (user_id, date)` works correctly across the partitioned table.
- **Between Redis and Postgres**: the Redis key `checkin:{userId}:{date}` using `SET NX` (set if not exists) is the first line of defense. If `SET NX` fails, the user already checked in — return 409 immediately without touching Postgres.
- **Race condition**: two concurrent check-in requests for the same user hit different API instances simultaneously. Both pass the Redis `SET NX` check? Only one wins (Redis is single-threaded per command). The loser gets `nil` back and returns 409.

This replaces the DB-level unique constraint as the primary race guard, with the DB constraint as the backstop.

---

### When to reconsider Postgres for writes

There is a threshold where even the write-buffer approach reaches its limits. If the company has multiple global offices in different timezones, the morning surge is spread across the day — which actually *helps* Postgres significantly.

But if it is a single-timezone company with strict 09:00 start times, and the employee count grows beyond ~3–5M:

| Write rate | Recommendation |
|-----------|----------------|
| < 2,500/sec (< 1M employees) | Postgres + PgBouncer, no buffer needed if well tuned |
| 2,500–10,000/sec (1–4M employees) | Redis write buffer + batched Postgres inserts |
| > 10,000/sec (4M+ employees) | Kafka as durable write buffer + multiple Postgres shards or Apache Cassandra for the write store |

At 10,000+ writes/sec sustained, even batched Postgres inserts start to strain. At that point, consider splitting the write store from the read store entirely (CQRS):
- **Write store**: Kafka (event log, infinitely scalable) or Cassandra (tuned for high write throughput, with careful consistency configuration)
- **Read store**: Postgres + TimescaleDB (populated asynchronously from the write store via consumers)

Cassandra at this scale is acceptable *only* for the write store — not for the integrity-critical data. The source of truth for "did this employee check in?" remains Postgres (or Kafka as the immutable log).

---

### Revised architecture at 1M employees

```
                    ┌──────────────────────┐
                    │    Load Balancer      │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ NestJS   │          │ NestJS   │          │ NestJS   │
  │ API #1   │          │ API #2   │    ...   │ API #N   │
  └────┬─────┘          └────┬─────┘          └────┬─────┘
       └──────────────────────┼──────────────────────┘
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
     ┌─────────────────┐              ┌─────────────────┐
     │  Redis Cluster  │              │  Kafka          │
     │  - Write buffer │──────────────│  - Event log    │
     │  - Status cache │              │  - Durable queue│
     │  - BullMQ jobs  │              └────────┬────────┘
     └─────────────────┘                       │
                                     ┌─────────┴──────────┐
                                     ▼                     ▼
                              ┌────────────┐       ┌──────────────┐
                              │  Consumer  │       │  Consumer    │
                              │  (batch    │       │  (notif,     │
                              │  DB flush) │       │   payroll)   │
                              └─────┬──────┘       └──────────────┘
                                    │
                    ┌───────────────┴──────────────┐
                    ▼                              ▼
           ┌──────────────┐             ┌──────────────────┐
           │  Postgres     │             │  Postgres        │
           │  Primary      │             │  Read Replicas   │
           │  (TimescaleDB)│             │  (×2 or more)    │
           │  write path   │             │  summary queries │
           └──────────────┘             └──────────────────┘
```

---

## 7. Summary

| Concern | Recommendation | When |
|---------|---------------|------|
| Race condition on check-in | `INSERT ON CONFLICT` + DB unique constraint | Phase 1 |
| Connection exhaustion | PgBouncer + connection pooling | Phase 1 |
| Switch away from Postgres? | **No** — Postgres is the right choice | N/A |
| Read spike (summaries) | Redis cache, 60s TTL | Phase 2 |
| MQ for core check-in write? | **No** — keep synchronous | N/A |
| MQ for side effects (notif, payroll) | Yes — BullMQ on Redis | Phase 3 |
| Horizontal scaling | Docker + Nginx + read replica | Phase 4 |

The system as designed in Phase 1+2 comfortably supports **~5,000 employees** with a single Postgres primary and a single NestJS instance. Phase 3 adds resilience. Phase 4 is a linear scale-out when you need it.

### Scale reference

| Employees | Peak writes/sec | Primary bottleneck | Recommended approach |
|-----------|----------------|-------------------|----------------------|
| < 10K | < 10/sec | None | Postgres + PgBouncer (Phase 1) |
| 10K–100K | 10–100/sec | Connection pool | + Redis cache (Phase 2) |
| 100K–1M | 100–2,500/sec | Write throughput, table size | + Redis write buffer + TimescaleDB partitioning (Phase 3–4) |
| 1M–4M | 2,500–10,000/sec | Postgres write ceiling | + Kafka durable buffer + Postgres sharding |
| 4M+ | > 10,000/sec | Single DB limit | CQRS split: Kafka write store + Postgres read store |
