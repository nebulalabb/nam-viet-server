import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
import taskService from '@services/task.service';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskQueryInput,
} from '@validators/task.validator';

class TaskController {
  // GET /api/tasks - Get all tasks with pagination & filters
  async getAllTasks(req: AuthRequest, res: Response) {
    const query = req.query as unknown as TaskQueryInput;

    const result = await taskService.getAllTasks(query);

    const response: ApiResponse = {
      success: true,
      data: result.tasks,
      meta: {
        page: result.meta.page,
        limit: result.meta.limit,
        total: result.meta.total,
        totalPage: result.meta.totalPages,
      },
      message: 'Lấy danh sách nhiệm vụ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/tasks/:id - Get task by ID
  async getTaskById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);

    const task = await taskService.getTaskById(id);

    const response: ApiResponse = {
      success: true,
      data: task,
      message: 'Lấy thông tin nhiệm vụ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/tasks - Create new task
  async createTask(req: AuthRequest, res: Response) {
    const data = req.body as CreateTaskInput;
    const userId = req.user!.id;

    const task = await taskService.createTask(userId, data);

    const response: ApiResponse = {
      success: true,
      data: task,
      message: 'Tạo nhiệm vụ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/tasks/:id - Update task
  async updateTask(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const data = req.body as UpdateTaskInput;
    const userId = req.user!.id;

    const task = await taskService.updateTask(id, data, userId);

    const response: ApiResponse = {
      success: true,
      data: task,
      message: 'Cập nhật nhiệm vụ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/tasks/:id - Delete task
  async deleteTask(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;

    await taskService.deleteTask(id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Xóa nhiệm vụ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new TaskController();
