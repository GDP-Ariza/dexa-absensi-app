import { Controller, Post, Get, Body, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AttendanceService } from './attendance.service';
import { LocationDto } from './dto/location.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(201)
  checkIn(@Request() req, @Body() dto: LocationDto) {
    return this.attendanceService.checkIn(req.user.id, dto);
  }

  @Post('check-out')
  @HttpCode(200)
  checkOut(@Request() req, @Body() dto: LocationDto) {
    return this.attendanceService.checkOut(req.user.id, dto);
  }

  @Get('summary')
  getSummary(@Request() req, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.getSummary(req.user.id, query);
  }
}
