export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerConfig {
  level?: LogLevel;
  enableResponseLogging?: boolean;
  enableRequestLogging?: boolean;
  enableMetadataLogging?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

export class Logger {
  private config: LoggerConfig;
  private currentLevel: number;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || 'debug',
      enableResponseLogging: config.enableResponseLogging !== false,
      enableRequestLogging: config.enableRequestLogging !== false,
      enableMetadataLogging: config.enableMetadataLogging !== false
    };
    this.currentLevel = LOG_LEVELS[this.config.level!];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.currentLevel;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      return `${prefix} ${message}\n${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  logResponse(response: {
    content: string;
    conversationId?: string;
    messageId?: string;
    metadata?: Record<string, any>;
    intent?: any;
    knowledgeResults?: any[];
  }): void {
    if (!this.config.enableResponseLogging) return;

    const logData: any = {
      content: response.content,
      length: response.content.length
    };

    if (response.conversationId) {
      logData.conversationId = response.conversationId;
    }

    if (response.messageId) {
      logData.messageId = response.messageId;
    }

    if (this.config.enableMetadataLogging) {
      if (response.metadata) {
        logData.metadata = response.metadata;
      }

      if (response.intent) {
        logData.intent = response.intent;
      }

      if (response.knowledgeResults && response.knowledgeResults.length > 0) {
        logData.knowledgeResults = response.knowledgeResults.map(r => ({
          title: r.title,
          score: r.score,
          type: r.type
        }));
      }
    }

    this.info('AI Response Generated', logData);
  }

  logRequest(request: {
    message: string;
    conversationId?: string;
    userId?: string;
    context?: Record<string, any>;
  }): void {
    if (!this.config.enableRequestLogging) return;

    const logData: any = {
      message: request.message,
      messageLength: request.message.length
    };

    if (request.conversationId) {
      logData.conversationId = request.conversationId;
    }

    if (request.userId) {
      logData.userId = request.userId;
    }

    if (this.config.enableMetadataLogging && request.context) {
      logData.context = request.context;
    }

    this.info('User Message Received', logData);
  }

  logStreamEvent(event: {
    type: string;
    conversationId?: string;
    content?: string;
    messageId?: string;
    error?: string;
  }): void {
    if (!this.config.enableResponseLogging) return;

    const logData: any = {
      eventType: event.type
    };

    if (event.conversationId) {
      logData.conversationId = event.conversationId;
    }

    if (event.content) {
      logData.content = event.content;
      logData.contentLength = event.content.length;
    }

    if (event.messageId) {
      logData.messageId = event.messageId;
    }

    if (event.error) {
      logData.error = event.error;
    }

    this.info('Stream Event', logData);
  }

  logIntentDetection(intent: {
    type: string;
    confidence: number;
    needsKnowledgeBase: boolean;
    enhancedQuery?: string;
    directResponse?: string;
  }): void {
    if (!this.shouldLog('debug')) return;

    const logData: any = {
      type: intent.type,
      confidence: intent.confidence,
      needsKnowledgeBase: intent.needsKnowledgeBase
    };

    if (intent.enhancedQuery) {
      logData.enhancedQuery = intent.enhancedQuery;
    }

    if (intent.directResponse) {
      logData.directResponse = intent.directResponse;
    }

    this.debug('Intent Detected', logData);
  }
}

