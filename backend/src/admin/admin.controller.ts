import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('attendance')
  getAllAttendance(@Query() filter: AttendanceFilterDto) {
    return this.adminService.getAllAttendance(filter);
  }

  @Get('employees')
  listEmployees(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listEmployees(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('employees/:id')
  getEmployee(@Param('id') id: string) {
    return this.adminService.getEmployee(id);
  }

  @Patch('employees/:id')
  updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.adminService.updateEmployee(id, dto);
  }
}
