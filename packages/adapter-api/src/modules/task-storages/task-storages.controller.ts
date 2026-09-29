import { Body, Controller, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaskStoragesService } from './task-storages.service';

@ApiTags('task-storages')
@Controller({ path: 'task-storages', version: '1' })
export class TaskStoragesController {
  constructor(private readonly taskStoragesService: TaskStoragesService) {}

  @Get(':hash')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read a task storage by hash' })
  get(@Param('hash') hash: string, @Headers('authorization') token: string) {
    return this.taskStoragesService.get(hash, this.token(token));
  }

  @Get(':hash/tasks/:taskId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read a task by storage hash and task ID' })
  getTask(@Param('hash') hash: string, @Param('taskId') taskId: string, @Headers('authorization') token: string) {
    return this.taskStoragesService.getTask(hash, taskId, this.token(token));
  }

  @Post(':hash/tasks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a task to a task storage' })
  createTask(@Param('hash') hash: string, @Body() body: Record<string, unknown>, @Headers('authorization') token: string) {
    return this.taskStoragesService.createTask(hash, body, this.token(token));
  }

  @Patch(':hash/tasks/:taskId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit, reassign, change status, or record task minutes' })
  updateTask(@Param('hash') hash: string, @Param('taskId') taskId: string, @Body() body: Record<string, unknown>, @Headers('authorization') token: string) {
    return this.taskStoragesService.updateTask(hash, taskId, body, this.token(token));
  }

  private token(value?: string) {
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token is required');
    return value.slice('Bearer '.length);
  }
}
