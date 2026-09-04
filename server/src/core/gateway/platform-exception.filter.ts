import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class PlatformExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const req = ctx.getRequest<{ url?: string; correlationId?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] })?.message ??
          (exception as Error)?.message ??
          'Internal error');

    if (status >= 500) {
      this.logger.error(
        `${req.url} → ${status}: ${JSON.stringify(message)}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: req.url,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
