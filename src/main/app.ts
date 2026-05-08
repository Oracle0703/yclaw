import { app, BrowserWindow, dialog, session, shell } from 'electron';
import type { WebContents } from 'electron';
import { WindowManager } from './windows/WindowManager';
import { IpcController } from './ipc/IpcController';
import { EventBus } from './ipc/EventBus';
import { DatabaseService } from './services/DatabaseService';
import { ConfigService } from './services/ConfigService';
import { LogService } from './services/LogService';
import { TrayService } from './services/TrayService';
import { UpdateService } from './services/UpdateService';
import { FeaturePackageService } from './services/FeaturePackageService';
import { SchedulerService } from './services/SchedulerService';
import { SessionRegistry } from './services/SessionRegistry';
import { TemplateService } from './services/TemplateService';
import { AlertService } from './services/AlertService';
import { ExecutionLogService } from './services/ExecutionLogService';
import { ResultService } from './services/ResultService';
import { ReviewService } from './services/ReviewService';
import { TaskRevisionService } from './services/TaskRevisionService';
import { WorkspaceService } from './services/WorkspaceService';
import { OperationsMetricsService } from './services/OperationsMetricsService';
import { DataCenterService } from './services/data-center/DataCenterService';
import { DataQualityService } from './services/data-center/DataQualityService';
import { DataExportService } from './services/data-center/DataExportService';
import { DatasetService } from './services/data-center/DatasetService';
import { WebhookTargetService } from './services/data-center/WebhookTargetService';
import { ApiTokenService } from './services/data-center/ApiTokenService';
import { LocalDataApiService } from './services/data-center/LocalDataApiService';
import { WebhookDeliveryService } from './services/data-center/WebhookDeliveryService';
import { CsvExporter } from './services/data-center/exporters/CsvExporter';
import { JsonExporter } from './services/data-center/exporters/JsonExporter';
import { JsonlExporter } from './services/data-center/exporters/JsonlExporter';
import { WebhookExporter } from './services/data-center/exporters/WebhookExporter';
import { HotAiInsightService } from './services/hot/HotAiInsightService';
import { HotNotificationService } from './services/hot/HotNotificationService';
import { HotReportService } from './services/hot/HotReportService';
import { HotRunProjectionService } from './services/hot/HotRunProjectionService';
import { HotSourceService } from './services/hot/HotSourceService';
import { HotTaskCompiler } from './services/hot/HotTaskCompiler';
import { HotTimelineScheduler } from './services/hot/HotTimelineScheduler';
import { TrendRadarConfigService } from './services/hot/TrendRadarConfigService';
import { CommentAiReplyService } from './services/comment/CommentAiReplyService';
import { CommentReportService } from './services/comment/CommentReportService';
import { CommentRunProjectionService } from './services/comment/CommentRunProjectionService';
import { CommentSourceService } from './services/comment/CommentSourceService';
import { CommentTaskCompiler } from './services/comment/CommentTaskCompiler';
import { MediaCrawlerExternalExecutor } from './services/comment/MediaCrawlerExternalExecutor';
import { MediaCrawlerResultImporter } from './services/comment/MediaCrawlerResultImporter';
import { MediaCrawlerService } from './services/comment/MediaCrawlerService';
import { TabManager } from './browser/TabManager';
import { EVENTS, IPC_CHANNELS, RUNNER_SCHEDULER_DEFAULTS } from '@shared/constants';
import { AIService } from './ai/AIService';
import { ContextManager } from './ai/ContextManager';
import { ToolRegistry } from './ai/ToolRegistry';
import { PluginLoader } from './plugin-loader/PluginLoader';
import { PermissionChecker } from './plugin-loader/PermissionChecker';
import { BatchService } from './services/BatchService';
import { RemoteRunnerService } from './services/RemoteRunnerService';
import { TaskService } from './services/TaskService';
import { bootstrapTaskAsCode, type TaskAsCodeBootstrap } from './services/task-as-code/bootstrap';
import { createDesktopMcpServer } from '@mcp/server/createDesktopMcpServer';
import {
  startEmbeddedMcpHttpServer,
  type EmbeddedMcpHttpHandle,
  type EmbeddedMcpHttpStatus,
} from '@mcp/server/startEmbeddedHttpServer';
import { McpClientManager } from '@mcp/client/McpClientManager';
import { DataSourceManager } from '@engines/analytics/DataSourceManager';
import { IndicatorLibrary } from '@engines/analytics/IndicatorLibrary';
import { AutomationEngine } from '@engines/automation/AutomationEngine';
import { FlowRunner } from '@engines/automation/FlowRunner';
import {
  DispatchQueueService,
  ExecutionLeaseService,
  LeaseReconciler,
  LocalRunnerAdapter,
  RemoteRunnerAdapter,
  RunnerDispatchService,
  RunnerRegistryService,
} from './services/runner-scheduler';
import path from 'path';
import { getRendererUrl } from './utils/paths';
import {
  AIRepository,
  AlertRepository,
  BatchRepository,
  CommentReportRepository,
  CommentSourceRepository,
  ExecutionLogRepository,
  HotReportRepository,
  HotSourceRepository,
  DataApiTokenRepository,
  DataQualityBatchInsightRepository,
  DataQualityFindingRepository,
  DataDatasetRepository,
  DataExportJobRepository,
  DataQualityRuleRepository,
  DataWebhookTargetRepository,
  PluginRepository,
  RemoteRunnerRepository,
  ReviewRepository,
  ResultRepository,
  RunnerSchedulerRepository,
  SessionRepository,
  SigninRunRepository,
  TaskRepository,
  TaskRevisionRepository,
  TemplateRepository,
  WorkspaceRepository,
} from './services/repositories';
import { registerRemoteRunnerHandlers } from './ipc/remote-runner-handlers';
import { registerRunnerSchedulerHandlers } from './ipc/runner-scheduler-handlers';
import { registerTaskOperationsHandlers } from './ipc/task-operations-handlers';
import { registerDataCenterHandlers } from './ipc/data-center-handlers';
import { registerHotHandlers } from './ipc/hot-handlers';
import { registerCommentHandlers } from './ipc/comment-handlers';
import { registerSigninHandlers } from './ipc/signin-handlers';
import type {
  AIChatRequest,
  AIConfig,
  ExecutionLease,
  McpClientServerConfig,
  McpClientServerStatus,
  OHLCVData,
  IndicatorType,
  DataSourceConfig,
  InterventionState,
  RunnerNode,
  RunnerQueueItem,
  SigninDebugSnapshot,
  TaskFlow,
} from '@shared/types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { JdSigninProvider } from './services/signin/JdSigninProvider';
import { EmailNotifier } from './services/signin/EmailNotifier';
import { NotificationService } from './services/signin/NotificationService';
import { SigninTaskService } from './services/signin/SigninTaskService';

interface RunnerSchedulerIpcService {
  listRunners(): unknown;
  heartbeat(payload: unknown): unknown;
  drain(payload: unknown): unknown;
  resume(payload: unknown): unknown;
  listQueue(): unknown;
  enqueue(payload: unknown): unknown;
  cancelQueueItem(payload: unknown): unknown;
  dispatchTick(): Promise<void>;
  listLeases(): ExecutionLease[];
  renewLease(payload: unknown): ExecutionLease | null;
  releaseLease(payload: unknown): ExecutionLease | null;
  reconcile(): void;
}

/**
 * 应用生命周期管理
 */
export class App {
  private windowManager: WindowManager;
  private ipcController: IpcController;
  private eventBus: EventBus;
  private databaseService: DatabaseService;
  private configService: ConfigService;
  private logService: LogService;
  private trayService: TrayService;
  private updateService: UpdateService;
  private featurePackageService: FeaturePackageService;
  private tabManager: TabManager;
  private aiService: AIService;
  private pluginLoader: PluginLoader;
  private permissionChecker: PermissionChecker;
  private taskService: TaskService;
  private remoteRunnerService: RemoteRunnerService;
  private runnerSchedulerService: RunnerSchedulerIpcService;
  private schedulerService: SchedulerService;
  private sessionRegistry: SessionRegistry;
  private templateService: TemplateService;
  private executionLogService: ExecutionLogService;
  private alertService: AlertService;
  private reviewService: ReviewService;
  private resultService: ResultService;
  private workspaceService: WorkspaceService;
  private taskRevisionService: TaskRevisionService;
  private operationsMetricsService: OperationsMetricsService;
  private hotSourceService: HotSourceService;
  private hotRunService: HotRunProjectionService;
  private hotReportService: HotReportService;
  private trendRadarConfigService: TrendRadarConfigService;
  private hotTimelineService: HotTimelineScheduler;
  private hotAiInsightService: HotAiInsightService;
  private hotNotificationService: HotNotificationService;
  private commentSourceService: CommentSourceService;
  private commentRunService: CommentRunProjectionService;
  private commentReportService: CommentReportService;
  private commentAiReplyService: CommentAiReplyService;
  private mediaCrawlerService: MediaCrawlerService;
  private notificationService: NotificationService;
  private signinTaskService: SigninTaskService;
  private signinPreviewWindow: BrowserWindow | null = null;
  private browserRecorderWindow: BrowserWindow | null = null;
  private dataCenterService: DataCenterService;
  private dataQualityService: DataQualityService;
  private dataExportService: DataExportService;
  private datasetService: DatasetService;
  private webhookTargetService: WebhookTargetService;
  private apiTokenService: ApiTokenService;
  private localDataApiService: LocalDataApiService;
  private dataSourceManager: DataSourceManager;
  private indicatorLibrary: IndicatorLibrary;
  private taskAsCode: TaskAsCodeBootstrap;
  private eventForwarders: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
  private interventionState: InterventionState | null = null;
  private embeddedMcpHttpServer: EmbeddedMcpHttpHandle | null = null;
  private mcpClientManager: McpClientManager;
  private started = false;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.configService = new ConfigService({ eventBus: this.eventBus });
    this.featurePackageService = new FeaturePackageService({ configService: this.configService });
    this.windowManager = new WindowManager({
      eventBus: this.eventBus,
      shouldCloseToTray: () => this.configService.getGeneral().closeToTray,
      resolveRendererUrl: (module: string) => this.resolveRendererUrl(module),
    });
    this.ipcController = new IpcController();
    this.databaseService = new DatabaseService();
    this.logService = new LogService();
    const taskRepository = new TaskRepository(this.databaseService);
    const pluginRepository = new PluginRepository(this.databaseService);
    const aiRepository = new AIRepository(this.databaseService);
    const sessionRepository = new SessionRepository(this.databaseService);
    const templateRepository = new TemplateRepository(this.databaseService);
    const alertRepository = new AlertRepository(this.databaseService);
    const batchRepository = new BatchRepository(this.databaseService);
    const executionLogRepository = new ExecutionLogRepository(this.databaseService);
    const signinRunRepository = new SigninRunRepository(this.databaseService);
    const hotSourceRepository = new HotSourceRepository(this.databaseService);
    const hotReportRepository = new HotReportRepository(this.databaseService);
    const commentSourceRepository = new CommentSourceRepository(this.databaseService);
    const commentReportRepository = new CommentReportRepository(this.databaseService);
    const workspaceRepository = new WorkspaceRepository(this.databaseService);
    const taskRevisionRepository = new TaskRevisionRepository(this.databaseService);
    const reviewRepository = new ReviewRepository(this.databaseService);
    const resultRepository = new ResultRepository(this.databaseService);
    const remoteRunnerRepository = new RemoteRunnerRepository(this.databaseService);
    const dataExportJobRepository = new DataExportJobRepository(this.databaseService);
    const dataDatasetRepository = new DataDatasetRepository(this.databaseService);
    const dataWebhookTargetRepository = new DataWebhookTargetRepository(this.databaseService);
    const dataApiTokenRepository = new DataApiTokenRepository(this.databaseService);
    const dataQualityRuleRepository = new DataQualityRuleRepository(this.databaseService);
    const dataQualityFindingRepository = new DataQualityFindingRepository(this.databaseService);
    const dataQualityBatchInsightRepository = new DataQualityBatchInsightRepository(
      this.databaseService,
    );
    this.trayService = new TrayService({
      eventBus: this.eventBus,
      windowManager: this.windowManager,
    });
    this.updateService = new UpdateService({
      eventBus: this.eventBus,
      logService: this.logService,
    });
    this.tabManager = new TabManager({
      eventBus: this.eventBus,
      sessionPartition: this.getBrowserSessionPartition(),
    });
    const toolRegistry = new ToolRegistry();
    this.mcpClientManager = new McpClientManager({
      toolRegistry,
      logService: this.logService,
    });
    this.permissionChecker = new PermissionChecker();
    this.pluginLoader = new PluginLoader({
      eventBus: this.eventBus,
      permissionChecker: this.permissionChecker,
    });
    const batchService = new BatchService({ batchRepository });
    this.taskService = new TaskService({
      taskRepository,
      batchService,
      eventBus: this.eventBus,
      createRunner: () =>
        new FlowRunner({
          engine: new AutomationEngine({
            resultService: this.resultService,
          }),
          eventBus: this.eventBus,
          executionLogService: this.executionLogService,
        }),
    });
    this.remoteRunnerService = new RemoteRunnerService({
      repository: remoteRunnerRepository,
      actorId: 'desktop',
    });
    const runnerSchedulerRepository = new RunnerSchedulerRepository(this.databaseService);
    const runnerRegistry = new RunnerRegistryService({ repository: runnerSchedulerRepository });
    const dispatchQueue = new DispatchQueueService({ repository: runnerSchedulerRepository });
    const leaseService = new ExecutionLeaseService({ repository: runnerSchedulerRepository });
    const leaseReconciler = new LeaseReconciler({ repository: runnerSchedulerRepository });
    const runnerDispatch = new RunnerDispatchService({
      queue: dispatchQueue,
      registry: runnerRegistry,
      leaseService,
      adapters: {
        local: new LocalRunnerAdapter(),
        remote: new RemoteRunnerAdapter(this.remoteRunnerService),
      },
      events: runnerSchedulerRepository,
    });
    this.runnerSchedulerService = {
      listRunners: () => runnerSchedulerRepository.listRunnerNodes(),
      heartbeat: (payload: unknown) => {
        const input = payload as {
          runnerId?: string;
          metrics?: Parameters<RunnerRegistryService['heartbeat']>[1];
        };
        if (typeof input.runnerId !== 'string' || input.runnerId.length === 0) {
          throw new Error('runnerId is required');
        }
        return runnerRegistry.heartbeat(input.runnerId, input.metrics ?? {});
      },
      drain: (payload: unknown) =>
        runnerRegistry.drain(this.extractSchedulerId(payload, 'runnerId')),
      resume: (payload: unknown) =>
        runnerRegistry.resume(this.extractSchedulerId(payload, 'runnerId')),
      listQueue: () => runnerSchedulerRepository.listQueueItems(),
      enqueue: (payload: unknown) =>
        dispatchQueue.enqueue(payload as Parameters<DispatchQueueService['enqueue']>[0]),
      cancelQueueItem: (payload: unknown) =>
        this.cancelRunnerQueueItem(runnerSchedulerRepository, payload),
      dispatchTick: () => runnerDispatch.tick(),
      listLeases: () => this.listRunnerLeases(),
      renewLease: (payload: unknown) => this.renewRunnerLease(runnerSchedulerRepository, payload),
      releaseLease: (payload: unknown) =>
        this.releaseRunnerLease(runnerSchedulerRepository, payload),
      reconcile: () => leaseReconciler.reconcile(),
    };
    this.schedulerService = new SchedulerService({
      taskService: this.taskService,
      executeTask: async (taskId: string) => {
        await this.executeTask(taskId);
      },
    });
    this.sessionRegistry = new SessionRegistry({ sessionRepository });
    this.templateService = new TemplateService({ templateRepository });
    this.workspaceService = new WorkspaceService({ workspaceRepository });
    this.taskRevisionService = new TaskRevisionService({
      taskRepository,
      revisionRepository: taskRevisionRepository,
    });
    this.executionLogService = new ExecutionLogService({ executionLogRepository });
    this.alertService = new AlertService({
      alertRepository,
      executionLogService: this.executionLogService,
      dutyPolicyProvider: this.workspaceService,
    });
    const emailNotifier = new EmailNotifier();
    this.notificationService = new NotificationService({
      alertService: this.alertService,
      emailNotifier,
      configService: this.configService,
    });
    const signinBrowserGateway = {
      openSessionPage: async ({ sessionPartition, url }: {
        sessionPartition: string;
        url: string;
      }) => {
        const view = this.tabManager.getOrCreateTabBySession(sessionPartition, 'about:blank');
        // 把 WebContentsView 挂到真实可见的 BrowserWindow，确保依赖
        // 懒加载/IntersectionObserver 的签到页面能正常渲染。
        this.attachToSigninPreviewWindow(view);
        await view.webContents.loadURL(url);
        await this.waitForSigninSurfaceVisible(view.webContents.id, url);
        return {
          tabId: view.webContents.id,
          webContentsId: view.webContents.id,
        };
      },
      executeJavaScript: async (script: string, tabId: number) =>
        this.tabManager.executeJavaScript(script, tabId),
      captureDebugContext: async (tabId: number) => this.captureSigninDebugContext(tabId),
      fetchWithSession: async ({ sessionPartition, url, method, headers, body }: {
        sessionPartition: string;
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }) => {
        const targetSession = sessionPartition === 'default'
          ? session.defaultSession
          : session.fromPartition(sessionPartition);
        return targetSession.fetch(url, {
          method,
          headers,
          body,
        });
      },
    };
    const jdSigninProvider = new JdSigninProvider({
      browser: signinBrowserGateway,
      logService: this.logService,
    });
    this.signinTaskService = new SigninTaskService({
      taskService: this.taskService,
      runRepository: signinRunRepository,
      sessionRegistry: this.sessionRegistry,
      provider: {
        run: (context) => jdSigninProvider.run(context),
      },
      scheduler: this.schedulerService,
      notificationService: this.notificationService,
    });
    this.reviewService = new ReviewService({ reviewRepository });
    this.resultService = new ResultService({ resultRepository });
    this.hotSourceService = new HotSourceService({
      sourceRepository: hotSourceRepository,
      taskService: this.taskService,
      taskCompiler: new HotTaskCompiler(),
    });
    this.hotRunService = new HotRunProjectionService({
      sourceRepository: hotSourceRepository,
      batchService,
      resultService: this.resultService,
      reportRepository: hotReportRepository,
      startTask: (source) => this.startHotRunTask(source),
    });
    this.trendRadarConfigService = new TrendRadarConfigService();
    this.hotReportService = new HotReportService({
      sourceRepository: hotSourceRepository,
      batchService,
      resultService: this.resultService,
      executionLogService: this.executionLogService,
      reportRepository: hotReportRepository,
      outputDir: path.join(process.cwd(), 'output'),
      revealFile: (filePath) => shell.showItemInFolder(filePath),
      trendRadarConfigService: this.trendRadarConfigService,
    });
    this.hotTimelineService = new HotTimelineScheduler();
    this.commentSourceService = new CommentSourceService({
      sourceRepository: commentSourceRepository,
      taskService: this.taskService,
      taskCompiler: new CommentTaskCompiler(),
    });
    this.commentRunService = new CommentRunProjectionService({
      sourceRepository: commentSourceRepository,
      batchService,
      resultService: this.resultService,
      reportRepository: commentReportRepository,
      startTask: (source) => this.startCommentRunTask(source),
    });
    this.commentReportService = new CommentReportService({
      sourceRepository: commentSourceRepository,
      batchService,
      resultService: this.resultService,
      reportRepository: commentReportRepository,
      outputDir: path.join(process.cwd(), 'output', 'comment-reports'),
      revealFile: (filePath) => shell.showItemInFolder(filePath),
    });
    const mediaCrawlerImporter = new MediaCrawlerResultImporter({
      resultService: this.resultService,
    });
    const mediaCrawlerExecutor = new MediaCrawlerExternalExecutor({
      configProvider: () => this.mediaCrawlerService.getConfig(),
      executionLogService: this.executionLogService,
      importer: mediaCrawlerImporter,
    });
    this.mediaCrawlerService = new MediaCrawlerService({
      configService: this.configService,
      executor: mediaCrawlerExecutor,
    });
    this.datasetService = new DatasetService({
      repository: dataDatasetRepository,
    });
    this.apiTokenService = new ApiTokenService({
      repository: dataApiTokenRepository,
    });
    const webhookDeliveryService = new WebhookDeliveryService({
      auditRepository: dataExportJobRepository,
    });
    this.webhookTargetService = new WebhookTargetService({
      repository: dataWebhookTargetRepository,
      deliveryService: webhookDeliveryService,
    });
    this.dataExportService = new DataExportService({
      resultService: this.resultService,
      exportJobRepository: dataExportJobRepository,
      exporters: {
        csv: new CsvExporter(),
        json: new JsonExporter(),
        jsonl: new JsonlExporter(),
        webhook: new WebhookExporter({
          deliveryService: webhookDeliveryService,
        }),
      },
    });
    this.dataCenterService = new DataCenterService({
      resultService: this.resultService,
      batchService,
      executionLogService: this.executionLogService,
      dataExportJobRepository,
    });
    this.dataQualityService = new DataQualityService({
      resultService: this.resultService,
      ruleRepository: dataQualityRuleRepository,
      findingRepository: dataQualityFindingRepository,
      batchInsightRepository: dataQualityBatchInsightRepository,
    });
    this.localDataApiService = new LocalDataApiService({
      dataCenterService: this.dataCenterService,
      datasetService: this.datasetService,
      dataExportService: this.dataExportService,
      tokenVerifier: dataApiTokenRepository,
    });
    this.operationsMetricsService = new OperationsMetricsService();
    const contextManager = new ContextManager({
      taskRepository,
      pluginRepository,
      taskOpsContextProvider: {
        collect: () => ({
          workspaces: this.workspaceService
            .listWorkspaces()
            .slice(0, 10)
            .map((workspace) => ({
              id: workspace.id,
              name: workspace.name,
            })),
          tasks: taskRepository
            .getTasks()
            .slice(0, 10)
            .map((task) => ({
              id: task.id,
              name: task.name,
              status: task.status,
              updatedAt: task.updatedAt,
              currentRevisionId: task.currentRevisionId ?? null,
            })),
          alerts: this.alertService.listAlerts({}).slice(0, 10),
          reviews: this.reviewService.listReviews({}).slice(0, 10),
          runners: (this.runnerSchedulerService.listRunners() as RunnerNode[])
            .slice(0, 10)
            .map((runner) => ({
              id: runner.id,
              name: runner.name,
              kind: runner.kind,
              status: runner.status,
              runningCount: runner.runningCount,
              maxConcurrency: runner.maxConcurrency,
            })),
          results: this.resultService
            .listResults({})
            .slice(0, 10)
            .map((result) => ({
              taskId: result.taskId,
              batchId: result.batchId,
              status: result.status,
              qualityStatus: result.qualityStatus,
              revisionId: result.revisionId,
            })),
        }),
      },
    });
    this.aiService = new AIService({
      config: this.configService.get('ai'),
      openWindow: (module: string) => this.windowManager.openWindow({ module }),
      startTask: (taskId: string) => this.taskService.startTask(taskId, this.getTaskWebContents()),
      taskRepository,
      aiRepository,
      contextManager,
      toolRegistry,
    });
    this.hotAiInsightService = new HotAiInsightService({
      aiClient: {
        summarize: async ({ prompt }) => {
          const response = await this.aiService.chat({ message: prompt });
          return response.message.content;
        },
      },
    });
    this.commentAiReplyService = new CommentAiReplyService({
      aiClient: {
        generate: async ({ prompt }) => {
          const response = await this.aiService.chat({ message: prompt });
          return response.message.content;
        },
      },
    });
    this.hotNotificationService = new HotNotificationService({
      deliver: async ({ url, headers, timeoutMs, payload }) => {
        const result = await webhookDeliveryService.deliver({
          exportJobId: `hot-notification-${Date.now()}`,
          url,
          headers,
          timeoutMs,
          payload,
        });
        return {
          status: result.status,
          error: result.error,
        };
      },
    });
    this.dataSourceManager = new DataSourceManager({ eventBus: this.eventBus });
    this.indicatorLibrary = new IndicatorLibrary();
    this.taskAsCode = bootstrapTaskAsCode({
      ipcController: this.ipcController,
      taskRepository,
      templateRepository,
      broadcast: (channel, payload) => {
        this.windowManager.broadcast(channel, payload);
      },
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      this.showWorkbench();
      return;
    }

    // 初始化数据库
    this.databaseService.open();
    await this.pluginLoader.loadAll();
    this.logService.info('main', 'Application starting...');

    // 注册 IPC handlers
    this.registerIpcHandlers();
    this.registerEventForwarders();
    await this.syncExternalMcpServers(this.configService.get('ai').mcp?.servers);
    this.schedulerService.start();

    // 创建系统托盘
    this.trayService.create();

    // 创建主窗口
    this.showWorkbench();

    this.started = true;
    this.logService.info('main', 'Application started successfully');
  }

  showWorkbench(): void {
    this.windowManager.openWindow({ module: 'workbench' });
  }

  private registerIpcHandlers(): void {
    // Task-as-Code（YAML 导入/导出/watch）handler 已在 bootstrapTaskAsCode 中注册到 ipcController
    registerRemoteRunnerHandlers({
      ipcController: this.ipcController,
      service: this.remoteRunnerService as never,
    });
    registerRunnerSchedulerHandlers({
      ipcController: this.ipcController,
      service: this.runnerSchedulerService,
    });
    registerTaskOperationsHandlers({
      ipcController: this.ipcController,
      workspaceService: this.workspaceService as never,
      taskRevisionService: this.taskRevisionService as never,
      reviewService: this.reviewService as never,
      alertService: this.alertService as never,
      templateService: this.templateService as never,
      resultService: this.resultService as never,
      operationsMetricsService: {
        buildAcceptanceMetrics: (taskId?: string) =>
          this.operationsMetricsService.buildAcceptanceMetrics(
            this.collectOperationsAcceptanceSnapshot(taskId),
          ),
      },
    });
    registerHotHandlers({
      ipcController: this.ipcController,
      hotSourceService: this.hotSourceService as never,
      hotRunService: this.hotRunService as never,
      hotReportService: this.hotReportService as never,
      hotTimelineService: this.hotTimelineService,
      hotAiInsightService: this.hotAiInsightService,
      hotNotificationService: this.hotNotificationService,
      hotResultService: this.resultService,
      hotConfigService: this.trendRadarConfigService,
    });
    registerCommentHandlers({
      ipcController: this.ipcController,
      commentSourceService: this.commentSourceService as never,
      commentRunService: this.commentRunService as never,
      commentResultService: this.resultService,
      commentReportService: this.commentReportService as never,
      commentAiReplyService: this.commentAiReplyService,
      mediaCrawlerService: this.mediaCrawlerService,
    });
    registerSigninHandlers({
      ipcController: this.ipcController,
      taskService: this.taskService as never,
      signinTaskService: this.signinTaskService as never,
      notificationService: this.notificationService as never,
      logService: this.logService as never,
    });
    this.ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE, (payload: unknown) => {
      const { taskId } = (payload as { taskId?: string }) ?? {};
      if (typeof taskId !== 'string' || taskId.length === 0) {
        throw new Error('taskId is required');
      }
      const task = this.taskService.getTaskDetail(taskId);
      if (this.isJdSigninTask(task)) {
        return this.captureJdLoginState(taskId);
      }
      throw new Error(`JD sign-in task "${taskId}" not found`);
    });
    registerDataCenterHandlers({
      ipcController: this.ipcController,
      eventBus: this.eventBus,
      dataCenterService: this.dataCenterService,
      dataExportService: this.dataExportService,
      datasetService: this.datasetService,
      webhookTargetService: this.webhookTargetService,
      apiTokenService: this.apiTokenService,
      localDataApiService: this.localDataApiService,
      dataQualityService: this.dataQualityService,
    });

    // 窗口管理
    this.ipcController.handle(IPC_CHANNELS.WINDOW_OPEN, (params: unknown) => {
      const { module, options } = params as { module: string; options?: Record<string, number> };
      this.windowManager.openWindow({ module, options });
      return { module };
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_CLOSE, (module: unknown) => {
      if (typeof module === 'string' && module.length > 0) {
        this.windowManager.closeWindow(module);
      } else {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.close();
      }
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.minimize();
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
    });

    this.ipcController.handle(IPC_CHANNELS.WINDOW_LIST, () => {
      return this.windowManager.getOpenModules();
    });

    // 配置
    this.ipcController.handle(IPC_CHANNELS.CONFIG_GET, (key: unknown) => {
      const validKeys = ['general', 'modules', 'plugins', 'ai', 'featurePackages'] as const;
      if (typeof key !== 'string' || !validKeys.includes(key as (typeof validKeys)[number])) {
        throw new Error(
          `Invalid config key: ${String(key)}. Expected one of: ${validKeys.join(', ')}`,
        );
      }
      return this.configService.get(key as keyof ReturnType<ConfigService['getAll']>);
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_SET, (params: unknown) => {
      const { key, value } = params as { key: string; value: unknown };
      this.configService.set(key as 'general', value as never);
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_GET_ALL, () => {
      return this.configService.getAll();
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_RESET, () => {
      this.configService.reset();
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_EXPORT, () => {
      return this.configService.exportConfig();
    });

    this.ipcController.handle(IPC_CHANNELS.CONFIG_IMPORT, (jsonString: unknown) => {
      this.configService.importConfig(jsonString as string);
    });

    this.ipcController.handle(IPC_CHANNELS.FEATURE_PACKAGE_LIST, () => {
      return this.featurePackageService.listPackages();
    });

    this.ipcController.handle(IPC_CHANNELS.FEATURE_PACKAGE_INSTALL, async (params: unknown) => {
      const { id } = params as { id: string };
      return this.featurePackageService.installPackage(id);
    });

    // 日志
    this.ipcController.handle(IPC_CHANNELS.LOG_WRITE, (params: unknown) => {
      const { level, source, message, data } = params as {
        level: 'debug' | 'info' | 'warn' | 'error';
        source: 'main' | 'renderer' | 'plugin' | 'engine';
        message: string;
        data?: unknown;
      };
      this.logService.write(level, source, message, data);
    });

    this.ipcController.handle(IPC_CHANNELS.LOG_EXPORT, () => {
      return this.logService.exportDebugPackage();
    });

    // 应用信息
    this.ipcController.handle(IPC_CHANNELS.APP_INFO, () => {
      return {
        version: app.getVersion(),
        name: app.getName(),
        platform: process.platform,
        electron: process.versions.electron,
        node: process.versions.node,
      };
    });

    // 检查更新
    this.ipcController.handle(IPC_CHANNELS.APP_CHECK_UPDATE, async () => {
      await this.updateService.checkForUpdates();
    });

    // AI 助手
    this.ipcController.handle(IPC_CHANNELS.AI_CHAT, async (request: unknown) => {
      return this.aiService.chat(request as AIChatRequest);
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONFIG_GET, () => {
      return this.configService.get('ai');
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONFIG_SET, async (config: unknown) => {
      const currentConfig = this.configService.get('ai');
      const partialConfig = config as Partial<AIConfig>;
      const nextConfig = {
        ...currentConfig,
        ...partialConfig,
        mcp: partialConfig.mcp
          ? {
              ...currentConfig.mcp,
              ...partialConfig.mcp,
              embeddedHttp: partialConfig.mcp.embeddedHttp
                ? {
                    ...currentConfig.mcp?.embeddedHttp,
                    ...partialConfig.mcp.embeddedHttp,
                  }
                : currentConfig.mcp?.embeddedHttp,
              servers: partialConfig.mcp.servers ?? currentConfig.mcp?.servers,
            }
          : currentConfig.mcp,
      };
      this.configService.set('ai', nextConfig);
      this.aiService.updateConfig(nextConfig);
      await this.syncExternalMcpServers(nextConfig.mcp?.servers);
      return nextConfig;
    });

    this.ipcController.handle(IPC_CHANNELS.AI_TOOLS_LIST, () => {
      return this.aiService.getToolRegistry().list();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_TOOL_EXECUTE, async (payload: unknown) => {
      const { name, params } =
        (payload as { name?: string; params?: Record<string, unknown> }) ?? {};

      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Tool name is required');
      }

      const context = await this.aiService.getContextManager().collectContext();
      return this.aiService.getToolRegistry().execute(name.trim(), params ?? {}, context);
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONVERSATION_LIST, () => {
      return this.aiService.listConversations();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_CONVERSATION_DELETE, (id: unknown) => {
      return this.aiService.deleteConversation(String(id));
    });

    this.ipcController.handle(IPC_CHANNELS.AI_MCP_START, async (params: unknown) => {
      const { host, port, token } =
        (params as { host?: string; port?: number; token?: string }) ?? {};
      return this.startEmbeddedMcpHttpServer({ host, port, token });
    });

    this.ipcController.handle(IPC_CHANNELS.AI_MCP_STOP, async () => {
      return this.stopEmbeddedMcpHttpServer();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_MCP_STATUS, () => {
      return this.getEmbeddedMcpHttpStatus();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_MCP_CLIENT_STATUS, () => {
      return this.getExternalMcpServerStatuses();
    });

    this.ipcController.handle(IPC_CHANNELS.AI_MCP_AUDIT_LIST, (payload: unknown) => {
      const limit = Number((payload as { limit?: number } | undefined)?.limit ?? 20);
      return this.logService.queryMcpAudit(Number.isFinite(limit) && limit > 0 ? limit : 20);
    });

    // 插件
    this.ipcController.handle(IPC_CHANNELS.PLUGIN_LIST, () => {
      return this.pluginLoader.getAll();
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_INSTALL, async (params: unknown) => {
      const { source, path: pluginPath } =
        (params as {
          source?: 'local';
          path?: string;
        }) ?? {};

      if (source !== 'local') {
        throw new Error('Only local plugin installation is supported in this version');
      }

      const selectedPath = pluginPath ?? (await this.pickLocalPluginPath());
      if (!selectedPath) {
        return null;
      }

      return this.pluginLoader.installFromPath(selectedPath);
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_PERMISSION_CHECK, (params: unknown) => {
      const { name, confirmed } = params as { name: string; confirmed: boolean };
      return this.pluginLoader.confirmPendingInstall(name, confirmed);
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_ENABLE, (params: unknown) => {
      const { name } = params as { name: string };
      this.pluginLoader.activate(name);
      return { name, status: 'active' };
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_DISABLE, (params: unknown) => {
      const { name } = params as { name: string };
      this.pluginLoader.deactivate(name);
      return { name, status: 'inactive' };
    });

    this.ipcController.handle(IPC_CHANNELS.PLUGIN_UNINSTALL, (params: unknown) => {
      const { name, confirmed } = params as { name: string; confirmed?: boolean };
      const plugin = this.pluginLoader.get(name);
      if (!plugin) {
        throw new Error(`Plugin "${name}" not found`);
      }
      if (this.permissionChecker.requiresUninstallConfirmation(plugin.manifest) && !confirmed) {
        throw new Error(`Uninstalling plugin "${name}" requires confirmation`);
      }
      this.pluginLoader.uninstall(name);
      return { name, status: 'uninstalled' };
    });

    // 任务
    this.ipcController.handle(IPC_CHANNELS.TASK_LIST, () => {
      return this.taskService.listTasks();
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_GET, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.getTaskFlow(taskId);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_SAVE, (params: unknown) => {
      const { taskId, name, steps } = params as {
        taskId?: string | null;
        name?: string;
        steps: TaskFlow['steps'];
      };
      return this.taskService.saveTaskFlow(taskId, { name, steps });
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_START, (params: unknown) => {
      const { taskId, tabId } = params as { taskId: string; tabId?: number };
      return this.executeTask(taskId, tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_PAUSE, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.pauseTask(taskId);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_RESUME, (params: unknown) => {
      const { taskId, tabId } = params as { taskId: string; tabId?: number };
      const webContents = this.getTaskWebContents(tabId);
      return this.taskService.resumeTask(taskId, webContents);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_STOP, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.stopTask(taskId);
    });

    this.ipcController.handle(IPC_CHANNELS.SCHEDULER_STATUS, () => {
      return this.schedulerService.getStatus();
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_BATCH_LIST, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.listBatches(taskId);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_BATCH_DETAIL, (params: unknown) => {
      const { batchId } = params as { batchId: string };
      return this.taskService.getBatch(batchId);
    });

    this.ipcController.handle(IPC_CHANNELS.BATCH_RETRY, (params: unknown) => {
      const { batchId } = params as { batchId: string };
      return this.taskService.retryBatch(batchId);
    });

    this.ipcController.handle(IPC_CHANNELS.SESSION_LIST, () => {
      return this.sessionRegistry.listSessions();
    });

    this.ipcController.handle(IPC_CHANNELS.SESSION_CREATE, (params: unknown) => {
      const { name, domain } = params as { name: string; domain: string };
      return this.sessionRegistry.createSession(name, domain);
    });

    this.ipcController.handle(IPC_CHANNELS.SESSION_DELETE, (params: unknown) => {
      const { sessionId } = params as { sessionId: string };
      this.sessionRegistry.deleteSession(sessionId);
      return { sessionId };
    });

    this.ipcController.handle(IPC_CHANNELS.SESSION_BIND, (params: unknown) => {
      const { taskId, sessionId } = params as { taskId: string; sessionId: string };
      this.sessionRegistry.bindTaskSession(taskId, sessionId);
      return { taskId, sessionId };
    });

    this.ipcController.handle(IPC_CHANNELS.TEMPLATE_LIST, () => {
      return this.templateService.listTemplates();
    });

    this.ipcController.handle(IPC_CHANNELS.TEMPLATE_SAVE, (params: unknown) => {
      const { id, name, fields, version, description, deprecated, pluginDependencies } =
        (params as {
          id?: string;
          name: string;
          fields: Array<{ name: string; selector: string; attribute: string }>;
          version?: string;
          description?: string | null;
          deprecated?: boolean;
          pluginDependencies?: string[];
        }) ?? { name: '', fields: [] };

      if (!name || !Array.isArray(fields)) {
        throw new Error('Invalid template payload');
      }

      return this.templateService.saveTemplate({
        id,
        name,
        fields,
        version,
        description,
        deprecated,
        pluginDependencies,
      });
    });

    this.ipcController.handle(IPC_CHANNELS.TEMPLATE_DELETE, (params: unknown) => {
      const { templateId } = params as { templateId: string };
      this.templateService.deleteTemplate(templateId);
      return { templateId };
    });

    this.ipcController.handle(IPC_CHANNELS.TEMPLATE_GOVERNANCE_UPDATE, (params: unknown) => {
      const { templateId, governance } = params as {
        templateId: string;
        governance: {
          version?: string;
          description?: string | null;
          deprecated?: boolean;
          pluginDependencies?: string[];
        };
      };

      if (!templateId || typeof governance !== 'object' || governance === null) {
        throw new Error('Invalid template governance payload');
      }

      this.templateService.updateTemplateGovernance(templateId, governance);
      return { templateId, governance };
    });

    this.ipcController.handle(IPC_CHANNELS.RECORDER_START, async (params: unknown) => {
      const { tabId, options } = (params as {
        tabId?: number;
        options?: Parameters<TabManager['startRecorder']>[1];
      }) ?? {};
      const view = this.tabManager.getView(tabId);
      if (view) {
        this.attachToBrowserRecorderWindow(view);
      }
      return this.tabManager.startRecorder(tabId, options);
    });

    this.ipcController.handle(IPC_CHANNELS.RECORDER_STOP, async (params: unknown) => {
      const { tabId } = (params as { tabId?: number }) ?? {};
      return this.tabManager.stopRecorder(tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.ALERT_LIST, (params: unknown) => {
      const { taskId } = (params as { taskId?: string }) ?? {};
      const created = this.alertService.aggregateFromExecutionLogs(10);
      const escalated = this.alertService.autoEscalateAlerts();
      created.forEach((alert) => {
        this.eventBus.emit(IPC_CHANNELS.ALERT_PUSHED, alert);
      });
      escalated.forEach((alert) => {
        this.eventBus.emit(IPC_CHANNELS.ALERT_PUSHED, alert);
      });
      return this.alertService.listAlerts({ taskId });
    });

    this.ipcController.handle(IPC_CHANNELS.ALERT_DISMISS, (params: unknown) => {
      const { alertId } = params as { alertId: string };
      this.alertService.dismissAlert(alertId);
      return { alertId };
    });

    // 股票
    this.ipcController.handle(IPC_CHANNELS.STOCK_DATA, (params: unknown) => {
      const { symbol, timeframe, sourceConfig } =
        (params as {
          symbol?: string;
          timeframe?: string;
          sourceConfig?: DataSourceConfig;
        }) ?? {};
      return this.getStockHistory({
        symbol: symbol ?? 'AAPL',
        timeframe: timeframe ?? '1D',
        sourceConfig,
      });
    });

    this.ipcController.handle(IPC_CHANNELS.STOCK_INDICATOR_CALC, (params: unknown) => {
      const { type, data, options } = params as {
        type: IndicatorType;
        data: OHLCVData[];
        options?: Record<string, number>;
      };
      return this.indicatorLibrary.calculate(type, data, options);
    });

    // 浏览器标签页
    this.ipcController.handle(IPC_CHANNELS.BROWSER_CREATE_TAB, (params: unknown) => {
      const { url } = (params as { url?: string }) ?? {};
      const view = this.tabManager.createTab(url);
      this.attachToBrowserRecorderWindow(view);
      const tabInfo = this.tabManager.getTabInfo(view.webContents.id);
      if (!tabInfo) {
        throw new Error('Failed to create browser tab');
      }
      return tabInfo;
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_CLOSE_TAB, (params: unknown) => {
      const { id } = params as { id: number };
      this.tabManager.closeTab(id);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_LIST_TABS, () => {
      return this.tabManager.getAllTabs();
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_NAVIGATE, (params: unknown) => {
      const { tabId, url } = params as { tabId: number; url: string };
      const view = this.tabManager.getView(tabId);
      if (view) {
        this.attachToBrowserRecorderWindow(view);
      }
      this.tabManager.navigate(url, tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_GO_BACK, (params: unknown) => {
      const { tabId } = params as { tabId?: number };
      this.tabManager.goBack(tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_GO_FORWARD, (params: unknown) => {
      const { tabId } = params as { tabId?: number };
      this.tabManager.goForward(tabId);
    });

    this.ipcController.handle(IPC_CHANNELS.BROWSER_RELOAD, (params: unknown) => {
      const { tabId } = params as { tabId?: number };
      this.tabManager.reload(tabId);
    });

    // 任务 CRUD
    this.ipcController.handle(IPC_CHANNELS.TASK_CREATE, (params: unknown) => {
      const payload = params as {
        name: string;
        description?: string;
        steps?: unknown[];
        entryUrl?: string;
        schedule?: unknown;
        sessionId?: string | null;
        templateId?: string | null;
      };
      return this.taskService.createTask(payload);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_UPDATE, (params: unknown) => {
      const { taskId, ...payload } = params as { taskId: string; [key: string]: unknown };
      return this.taskService.updateTaskFlow(
        taskId,
        payload as Parameters<TaskService['updateTaskFlow']>[1],
      );
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_DELETE, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      this.taskService.deleteTask(taskId);
      return { taskId };
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_DETAIL, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.getTaskDetail(taskId);
    });

    this.ipcController.handle(IPC_CHANNELS.TASK_CLONE, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      return this.taskService.cloneTask(taskId);
    });

    // 采集结果
    this.ipcController.handle(IPC_CHANNELS.RESULT_LIST, (params: unknown) => {
      const { taskId, batchId } = (params as { taskId?: string; batchId?: string }) ?? {};
      return this.resultService.listResults({ taskId, batchId });
    });

    this.ipcController.handle(IPC_CHANNELS.RESULT_DETAIL, (params: unknown) => {
      const { resultId } = params as { resultId: string };
      return this.resultService.getResult(resultId);
    });

    this.ipcController.handle(IPC_CHANNELS.RESULT_EXPORT, (params: unknown) => {
      const { taskId, batchId, format } = params as {
        taskId?: string;
        batchId?: string;
        format: 'csv' | 'json' | 'jsonl';
      };
      return this.resultService.exportResults({ taskId, batchId }, format);
    });

    this.ipcController.handle(IPC_CHANNELS.RESULT_MARK_SUSPICIOUS, (params: unknown) => {
      const { resultId } = params as { resultId: string };
      this.resultService.markSuspicious(resultId);
      return { resultId };
    });

    // 执行日志
    this.ipcController.handle(IPC_CHANNELS.EXEC_LOG_QUERY, (params: unknown) => {
      const query =
        (params as { taskId?: string; batchId?: string; level?: 'info' | 'warn' | 'error' }) ?? {};
      return this.executionLogService.query(query);
    });

    // 介入管理
    this.ipcController.handle(IPC_CHANNELS.INTERVENTION_STATUS, () => {
      return this.interventionState;
    });

    this.ipcController.handle(IPC_CHANNELS.INTERVENTION_TAKEOVER, (params: unknown) => {
      const { taskId, batchId } = params as { taskId: string; batchId: string };
      this.interventionState = {
        taskId,
        batchId,
        flowRunnerStatus: 'intervention',
        webContentsId: this.tabManager.getActiveTabId() ?? 0,
        sessionPartition: 'default',
      };
      this.eventBus.emit(IPC_CHANNELS.INTERVENTION_STEP_INFO, this.interventionState);
      return this.interventionState;
    });

    this.ipcController.handle(IPC_CHANNELS.INTERVENTION_RESUME, (params: unknown) => {
      const { taskId } = params as { taskId: string };
      this.interventionState = null;
      const webContents = this.tabManager.getView()?.webContents;
      if (webContents) {
        this.taskService.resumeTask(taskId, webContents);
      }
      return { taskId, resumed: true };
    });

    this.ipcController.handle(IPC_CHANNELS.INTERVENTION_SCREENSHOT, async (params: unknown) => {
      const { tabId } = (params as { tabId?: number }) ?? {};
      const view = this.tabManager.getView(tabId);
      if (!view) throw new Error('No active tab for screenshot');
      const image = await view.webContents.capturePage();
      return image.toDataURL();
    });
  }

  private async executeTask(taskId: string, tabId?: number): Promise<unknown> {
    const task = this.taskService.getTaskDetail(taskId);
    if (task?.kind === 'jd-signin') {
      return this.signinTaskService.runTask(taskId);
    }
    if (typeof task?.kind === 'string' && task.kind.endsWith('-signin')) {
      throw new Error(`Unsupported sign-in task kind "${task.kind}"`);
    }

    const webContents = this.getTaskWebContents(tabId);
    return this.taskService.startTask(taskId, webContents);
  }

  private startHotRunTask(source: { taskId: string; sourceKind?: string }): unknown {
    if (source.sourceKind === 'browser') {
      return this.taskService.startTask(source.taskId, this.getTaskWebContents());
    }

    return this.taskService.startTask(source.taskId, createHeadlessAutomationPage());
  }

  private startCommentRunTask(source: { taskId: string; sessionId?: string | null }): unknown {
    const sessionPartition = this.resolveTaskSessionPartition(source.sessionId);
    let view = sessionPartition
      ? this.tabManager.getOrCreateTabBySession(sessionPartition, 'about:blank')
      : this.tabManager.getView();
    if (!view) {
      view = this.tabManager.createTab('about:blank');
    }
    this.attachToBrowserRecorderWindow(view);

    return this.taskService.startTask(source.taskId, view.webContents);
  }

  /**
   * 把签到任务用到的 WebContentsView 挂到一个真实可见的 BrowserWindow 上。
   * 仅复用单一窗口（不存在或已销毁则新建）。这样：
   * 1. chromium 给页面分配真实 viewport / visibilityState=visible，
   *    避免签到页懒加载区域无法渲染。
   * 2. 用户能直接在窗口里看到签到执行过程，便于人工介入和定位。
   */
  private attachToSigninPreviewWindow(view: import('electron').WebContentsView): void {
    let win = this.signinPreviewWindow;
    if (!win || win.isDestroyed()) {
      win = new BrowserWindow({
        width: 1280,
        height: 860,
        title: '签到执行预览',
        autoHideMenuBar: true,
      });
      win.on('closed', () => {
        this.signinPreviewWindow = null;
      });
      this.signinPreviewWindow = win;
    }

    const previewWindow = win;
    const children = previewWindow.contentView.children ?? [];
    for (const existing of children) {
      if (existing !== view) {
        try {
          previewWindow.contentView.removeChildView(existing);
        } catch {
          /* noop */
        }
      }
    }
    if (!children.includes(view)) {
      previewWindow.contentView.addChildView(view);
    }

    const applyBounds = () => {
      const bounds = previewWindow.getContentBounds();
      view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    };
    applyBounds();
    previewWindow.removeAllListeners('resize');
    previewWindow.on('resize', applyBounds);

    if (!previewWindow.isVisible()) {
      previewWindow.show();
    } else {
      previewWindow.focus();
    }
  }

  /**
   * `/browser` 的录制目标必须挂到真实 BrowserWindow 上，否则页面会停留在
   * 隐藏 WebContentsView 状态，用户看不到也无法操作。
   */
  private attachToBrowserRecorderWindow(view: import('electron').WebContentsView): void {
    let win = this.browserRecorderWindow;
    if (!win || win.isDestroyed()) {
      win = new BrowserWindow({
        width: 1280,
        height: 860,
        title: '浏览器录制窗口',
        autoHideMenuBar: true,
      });
      win.on('closed', () => {
        this.browserRecorderWindow = null;
      });
      this.browserRecorderWindow = win;
    }

    const recorderWindow = win;
    const children = recorderWindow.contentView.children ?? [];
    for (const existing of children) {
      if (existing !== view) {
        try {
          recorderWindow.contentView.removeChildView(existing);
        } catch {
          /* noop */
        }
      }
    }
    if (!children.includes(view)) {
      recorderWindow.contentView.addChildView(view);
    }

    const applyBounds = () => {
      const bounds = recorderWindow.getContentBounds();
      view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    };
    applyBounds();
    recorderWindow.removeAllListeners('resize');
    recorderWindow.on('resize', applyBounds);

    if (!recorderWindow.isVisible()) {
      recorderWindow.show();
    } else {
      recorderWindow.focus();
    }
  }

  private async waitForSigninSurfaceVisible(tabId: number, url: string): Promise<void> {
    const timeoutMs = 10_000;
    const intervalMs = 150;
    const deadline = Date.now() + timeoutMs;
    let lastSnapshot:
      | {
        readyState?: string;
        visibilityState?: string;
        viewport?: string;
      }
      | undefined;

    while (Date.now() <= deadline) {
      try {
        const snapshot = await this.tabManager.executeJavaScript(
          `
          (() => {
            const readyState =
              typeof document.readyState === 'string' ? document.readyState : undefined;
            const visibilityState =
              typeof document.visibilityState === 'string' ? document.visibilityState : undefined;
            const viewport =
              typeof window.innerWidth === 'number' && typeof window.innerHeight === 'number'
                ? window.innerWidth + 'x' + window.innerHeight
                : undefined;
            return {
              readyState,
              visibilityState,
              viewport,
            };
          })();
          `,
          tabId,
        ) as {
          readyState?: string;
          visibilityState?: string;
          viewport?: string;
        } | null;

        lastSnapshot = snapshot ?? undefined;
        const readyState = snapshot?.readyState ?? '';
        const visibilityState = snapshot?.visibilityState ?? '';
        const viewport = snapshot?.viewport ?? '';
        const [width, height] = viewport.split('x').map((value) => Number.parseInt(value, 10));
        const hasViewport = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;

        if (readyState !== 'loading' && visibilityState === 'visible' && hasViewport) {
          return;
        }
      } catch {
        // 页面跳转 / 渲染切换过程中 executeJavaScript 可能短暂失败，继续轮询。
      }

      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }

    this.logService.warn('main', 'signin preview visibility wait timed out', {
      tabId,
      url,
      ...lastSnapshot,
    });
  }

  private isJdSigninTask(task: ReturnType<TaskService['getTaskDetail']>): boolean {
    return task?.kind === 'jd-signin' && task.signin?.site === 'jd';
  }

  private resolveTaskSessionPartition(sessionId: string | null | undefined): string {
    if (!sessionId) {
      return 'default';
    }
    return this.sessionRegistry.listSessions().find((item) => item.id === sessionId)?.partition
      ?? 'default';
  }

  private async captureJdLoginState(taskId: string): Promise<{
    userName?: string | null;
    localStorageSnapshot?: Record<string, string> | null;
    captureDiagnostics?: {
      pageUrl?: string | null;
      pageTitle?: string | null;
      localStorageKeys?: string[];
      sessionStorageKeys?: string[];
      cookieDomains?: string[];
      networkResponseCount?: number;
      tokenHintResponseUrls?: string[];
    } | null;
    timedOut: boolean;
  }> {
    const task = this.taskService.getTaskDetail(taskId);
    if (!task || !task.signin || !this.isJdSigninTask(task)) {
      throw new Error(`JD sign-in task "${taskId}" not found`);
    }

    const sessionPartition = this.resolveTaskSessionPartition(task.sessionId);
    const loginUrl = 'https://passport.jd.com/new/login.aspx?ReturnUrl=https%3A%2F%2Finteract.jd.com%2F';
    const captureContext = {
      taskId,
      taskName: task.name,
      sessionId: task.sessionId ?? null,
      sessionPartition,
      loginUrl,
    };
    this.logService.info('main', 'jd signin login capture started', captureContext);

    try {
      const view = this.tabManager.getOrCreateTabBySession(sessionPartition, 'about:blank');
      this.attachToSigninPreviewWindow(view);
      await view.webContents.loadURL(loginUrl);

      const targetSession = sessionPartition === 'default'
        ? session.defaultSession
        : session.fromPartition(sessionPartition);
      const deadline = Date.now() + 5 * 60 * 1000;
      const pollIntervalMs = 1500;

      while (Date.now() < deadline) {
        if (view.webContents.isDestroyed()) break;
        const cookies = await targetSession.cookies.get({});
        const hasJdLoginCookie = cookies.some((cookie) =>
          ['pin', 'thor', 'pt_key', 'pt_pin'].includes(cookie.name) &&
          /(^|\.)jd\.com$/.test((cookie.domain ?? '').replace(/^\./, '')),
        );
        if (hasJdLoginCookie) {
          const snapshot = await this.collectPageStorageSnapshot(view.webContents);
          this.taskService.updateTaskFlow(taskId, {
            entryUrl: 'https://interact.jd.com/',
            signin: {
              ...task.signin,
              site: 'jd',
              mode: 'api-first-browser-fallback',
              fallbackApiEnabled: true,
              userName: snapshot.userName,
              localStorageSnapshot: snapshot.localStorageSnapshot,
              captureDiagnostics: {
                pageUrl: snapshot.pageUrl,
                pageTitle: snapshot.pageTitle,
                localStorageKeys: Object.keys(snapshot.localStorageSnapshot ?? {}),
                sessionStorageKeys: snapshot.sessionStorageKeys,
                cookieDomains: normalizeCookieDomains(cookies),
                networkResponseCount: 0,
                tokenHintResponseUrls: [],
              },
            },
          });

          this.logService.info('main', 'jd signin login capture succeeded', {
            ...captureContext,
            userName: snapshot.userName,
            cookieCount: cookies.length,
          });

          const previewWindow = this.signinPreviewWindow;
          if (previewWindow && !previewWindow.isDestroyed()) {
            previewWindow.close();
          }

          return {
            userName: snapshot.userName,
            localStorageSnapshot: snapshot.localStorageSnapshot,
            captureDiagnostics: {
              pageUrl: snapshot.pageUrl,
              pageTitle: snapshot.pageTitle,
              localStorageKeys: Object.keys(snapshot.localStorageSnapshot ?? {}),
              sessionStorageKeys: snapshot.sessionStorageKeys,
              cookieDomains: normalizeCookieDomains(cookies),
              networkResponseCount: 0,
              tokenHintResponseUrls: [],
            },
            timedOut: false,
          };
        }
        await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      return {
        captureDiagnostics: await this.collectGenericCaptureDiagnostics(view.webContents),
        timedOut: true,
      };
    } catch (error) {
      this.logService.error('main', 'jd signin login capture failed', {
        ...captureContext,
        error: this.serializeErrorForLog(error),
      });
      throw error;
    }
  }

  private async collectPageStorageSnapshot(webContents: WebContents): Promise<{
    pageUrl: string | null;
    pageTitle: string | null;
    userName: string | null;
    localStorageSnapshot: Record<string, string>;
    sessionStorageKeys: string[];
  }> {
    try {
      return await webContents.executeJavaScript(`
        (() => {
          const localStorageSnapshot = {};
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (!key) continue;
            const value = window.localStorage.getItem(key);
            if (typeof value === 'string') localStorageSnapshot[key] = value;
          }
          const sessionStorageKeys = [];
          for (let index = 0; index < window.sessionStorage.length; index += 1) {
            const key = window.sessionStorage.key(index);
            if (key) sessionStorageKeys.push(key);
          }
          const text = document.body?.innerText || '';
          const userNameMatch = text.match(/我的京东\\s*返回京东首页|([^\\s]{1,24})\\s+我的订单/);
          return {
            pageUrl: location.href,
            pageTitle: document.title,
            userName: userNameMatch && userNameMatch[1] ? userNameMatch[1] : null,
            localStorageSnapshot,
            sessionStorageKeys,
          };
        })();
      `) as {
        pageUrl: string | null;
        pageTitle: string | null;
        userName: string | null;
        localStorageSnapshot: Record<string, string>;
        sessionStorageKeys: string[];
      };
    } catch {
      return {
        pageUrl: webContents.getURL() || null,
        pageTitle: null,
        userName: null,
        localStorageSnapshot: {},
        sessionStorageKeys: [],
      };
    }
  }

  private async collectGenericCaptureDiagnostics(webContents: WebContents): Promise<{
    pageUrl?: string | null;
    pageTitle?: string | null;
    localStorageKeys?: string[];
    sessionStorageKeys?: string[];
    cookieDomains?: string[];
    networkResponseCount?: number;
    tokenHintResponseUrls?: string[];
  }> {
    const snapshot = await this.collectPageStorageSnapshot(webContents);
    return {
      pageUrl: snapshot.pageUrl,
      pageTitle: snapshot.pageTitle,
      localStorageKeys: Object.keys(snapshot.localStorageSnapshot ?? {}),
      sessionStorageKeys: snapshot.sessionStorageKeys,
      cookieDomains: [],
      networkResponseCount: 0,
      tokenHintResponseUrls: [],
    };
  }

  private serializeErrorForLog(error: unknown): {
    message: string;
    stack?: string;
  } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      message: String(error),
    };
  }

  private async captureSigninDebugContext(tabId: number): Promise<SigninDebugSnapshot | undefined> {
    const view = this.tabManager.getView(tabId);
    if (!view) {
      return undefined;
    }

    const snapshot = await this.tabManager.executeJavaScript(
      `
      (() => {
        const normalizeText = (value) => value.replace(/\\s+/g, ' ').trim();
        const domSummary = normalizeText(document.body?.innerText ?? '').slice(0, 1000);
        const pageUrl = typeof window.location?.href === 'string' ? window.location.href : '';
        const pageTitle = typeof document.title === 'string' ? document.title : '';
        const readyState = typeof document.readyState === 'string' ? document.readyState : '';
        const visibilityState = typeof document.visibilityState === 'string' ? document.visibilityState : '';
        const viewport =
          typeof window.innerWidth === 'number' && typeof window.innerHeight === 'number'
            ? window.innerWidth + 'x' + window.innerHeight
            : '';
        return {
          pageUrl: pageUrl || undefined,
          pageTitle: pageTitle || undefined,
          domSummary: domSummary || undefined,
          readyState: readyState || undefined,
          visibilityState: visibilityState || undefined,
          viewport: viewport || undefined,
        };
      })();
      `,
      tabId,
    );

    const baseSnapshot = (snapshot as SigninDebugSnapshot | undefined) ?? {};
    try {
      const image = await view.webContents.capturePage();
      return {
        ...baseSnapshot,
        screenshotDataUrl: image.toDataURL(),
      };
    } catch {
      return baseSnapshot;
    }
  }

  private collectOperationsAcceptanceSnapshot(taskId?: string) {
    const scopedTaskIds = taskId ? [taskId] : this.taskService.listTasks().map((task) => task.id);

    const batches = scopedTaskIds.flatMap((id) => this.taskService.listBatches(id));

    return {
      batches,
      alerts: this.alertService.listAlerts(taskId ? { taskId } : {}),
      results: this.resultService.listResults(taskId ? { taskId } : {}),
      reviews: this.reviewService.listReviews(taskId ? { taskId } : {}),
    };
  }

  shutdown(): void {
    this.logService.info('main', 'Application shutting down...');
    this.started = false;
    for (const { event, listener } of this.eventForwarders) {
      this.eventBus.off(event, listener);
    }
    this.eventForwarders = [];
    // dispose 是 async：兜底捕获，避免 watcher 关闭异常被吞；不阻塞同步 shutdown 流。
    this.taskAsCode.dispose().catch((err) => {
      this.logService.error('main', 'task-as-code dispose failed', err as Error);
    });
    if (this.embeddedMcpHttpServer) {
      void this.embeddedMcpHttpServer.close().catch((err) => {
        this.logService.error('main', 'embedded mcp http shutdown failed', err as Error);
      });
      this.embeddedMcpHttpServer = null;
    }
    void this.mcpClientManager.close().catch((err) => {
      this.logService.error('main', 'external mcp client shutdown failed', err as Error);
    });
    const previewWindow = this.signinPreviewWindow;
    if (previewWindow && !previewWindow.isDestroyed()) {
      try {
        previewWindow.close();
      } catch {
        /* noop */
      }
    }
    this.signinPreviewWindow = null;
    const recorderWindow = this.browserRecorderWindow;
    if (recorderWindow && !recorderWindow.isDestroyed()) {
      try {
        recorderWindow.close();
      } catch {
        /* noop */
      }
    }
    this.browserRecorderWindow = null;
    this.ipcController.dispose();
    this.dataSourceManager.closeAll();
    this.databaseService.close();
    this.logService.close();
    this.trayService.destroy();
    this.tabManager.closeAll();
    this.windowManager.closeAll();
  }

  createEmbeddedMcpServer(): McpServer {
    return createDesktopMcpServer({
      taskService: this.taskService,
      resultService: this.resultService,
      executionLogService: this.executionLogService,
      sessionRegistry: this.sessionRegistry,
      tabManager: this.tabManager,
      windowManager: this.windowManager,
      logService: this.logService,
    });
  }

  async startEmbeddedMcpHttpServer(
    options: {
      host?: string;
      port?: number;
      token?: string;
    } = {},
  ): Promise<EmbeddedMcpHttpStatus> {
    if (this.embeddedMcpHttpServer) {
      return this.getEmbeddedMcpHttpStatus();
    }

    const configured = this.configService.get('ai').mcp?.embeddedHttp;
    this.embeddedMcpHttpServer = await startEmbeddedMcpHttpServer({
      createServer: () => this.createEmbeddedMcpServer(),
      host: options.host ?? configured?.host,
      port: options.port ?? configured?.port,
      token: options.token ?? configured?.token,
      logService: this.logService,
    });

    return this.getEmbeddedMcpHttpStatus();
  }

  async stopEmbeddedMcpHttpServer(): Promise<EmbeddedMcpHttpStatus> {
    if (this.embeddedMcpHttpServer) {
      await this.embeddedMcpHttpServer.close();
      this.embeddedMcpHttpServer = null;
    }

    return this.getEmbeddedMcpHttpStatus();
  }

  getEmbeddedMcpHttpStatus(): EmbeddedMcpHttpStatus {
    if (!this.embeddedMcpHttpServer) {
      return { running: false };
    }

    const { running, host, port, endpoint, transport, mode, authRequired } =
      this.embeddedMcpHttpServer;
    return { running, host, port, endpoint, transport, mode, authRequired };
  }

  getExternalMcpServerStatuses(): McpClientServerStatus[] {
    return this.mcpClientManager.getServerStatuses();
  }

  private async syncExternalMcpServers(servers?: McpClientServerConfig[]): Promise<void> {
    await this.mcpClientManager.syncServers(servers ?? []);
  }

  private cancelRunnerQueueItem(
    repository: RunnerSchedulerRepository,
    payload: unknown,
  ): RunnerQueueItem | null {
    const queueItemId = this.extractSchedulerId(payload, 'queueItemId');
    const queueItem = repository.listQueueItems().find((item) => item.id === queueItemId);
    if (!queueItem) {
      return null;
    }

    if (queueItem.status !== 'queued') {
      throw new Error('Only queued items can be cancelled');
    }

    return repository.saveQueueItem({
      ...queueItem,
      status: 'cancelled',
      lastError: queueItem.lastError ?? 'Cancelled by operator',
      updatedAt: new Date().toISOString(),
    });
  }

  private listRunnerLeases(): ExecutionLease[] {
    const rows = this.databaseService.all<{
      id: string;
      execution_id: string;
      queue_item_id: string;
      runner_id: string;
      task_id: string;
      lease_token: string;
      status: ExecutionLease['status'];
      expires_at: string;
      last_renewed_at: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id,
        execution_id,
        queue_item_id,
        runner_id,
        task_id,
        lease_token,
        status,
        expires_at,
        last_renewed_at,
        created_at,
        updated_at
      FROM execution_leases
      ORDER BY created_at DESC`,
    );

    return rows.map((row) => ({
      id: row.id,
      executionId: row.execution_id,
      queueItemId: row.queue_item_id,
      runnerId: row.runner_id,
      taskId: row.task_id,
      leaseToken: row.lease_token,
      status: row.status,
      expiresAt: row.expires_at,
      lastRenewedAt: row.last_renewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private renewRunnerLease(
    repository: RunnerSchedulerRepository,
    payload: unknown,
  ): ExecutionLease | null {
    const leaseId = this.extractSchedulerId(payload, 'leaseId');
    const lease = this.findRunnerLease(leaseId);
    if (!lease) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const ttlMs = this.extractLeaseTtl(payload);
    const renewedLease: ExecutionLease = {
      ...lease,
      status: 'active',
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      lastRenewedAt: nowIso,
      updatedAt: nowIso,
    };

    return repository.saveExecutionLease(renewedLease);
  }

  private releaseRunnerLease(
    repository: RunnerSchedulerRepository,
    payload: unknown,
  ): ExecutionLease | null {
    const leaseId = this.extractSchedulerId(payload, 'leaseId');
    const lease = this.findRunnerLease(leaseId);
    if (!lease) {
      return null;
    }

    const releasedLease: ExecutionLease = {
      ...lease,
      status: 'released',
      updatedAt: new Date().toISOString(),
    };

    return repository.saveExecutionLease(releasedLease);
  }

  private findRunnerLease(leaseId: string): ExecutionLease | null {
    const row = this.databaseService.get<{
      id: string;
      execution_id: string;
      queue_item_id: string;
      runner_id: string;
      task_id: string;
      lease_token: string;
      status: ExecutionLease['status'];
      expires_at: string;
      last_renewed_at: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id,
        execution_id,
        queue_item_id,
        runner_id,
        task_id,
        lease_token,
        status,
        expires_at,
        last_renewed_at,
        created_at,
        updated_at
      FROM execution_leases
      WHERE id = ?`,
      [leaseId],
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      executionId: row.execution_id,
      queueItemId: row.queue_item_id,
      runnerId: row.runner_id,
      taskId: row.task_id,
      leaseToken: row.lease_token,
      status: row.status,
      expiresAt: row.expires_at,
      lastRenewedAt: row.last_renewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private extractSchedulerId(payload: unknown, primaryField: string): string {
    if (typeof payload === 'string' && payload.length > 0) {
      return payload;
    }

    if (typeof payload !== 'object' || payload === null) {
      throw new Error(`${primaryField} is required`);
    }

    const record = payload as Record<string, unknown>;
    const primary = record[primaryField];
    if (typeof primary === 'string' && primary.length > 0) {
      return primary;
    }

    const fallback = record.id;
    if (typeof fallback === 'string' && fallback.length > 0) {
      return fallback;
    }

    throw new Error(`${primaryField} is required`);
  }

  private extractLeaseTtl(payload: unknown): number {
    if (typeof payload !== 'object' || payload === null) {
      return RUNNER_SCHEDULER_DEFAULTS.leaseTtlMs;
    }

    const leaseTtlMs = (payload as { leaseTtlMs?: unknown }).leaseTtlMs;
    if (typeof leaseTtlMs !== 'number' || !Number.isFinite(leaseTtlMs) || leaseTtlMs <= 0) {
      return RUNNER_SCHEDULER_DEFAULTS.leaseTtlMs;
    }

    return leaseTtlMs;
  }

  private createMockStockHistory(symbol: string): OHLCVData[] {
    const data: OHLCVData[] = [];
    const baseTime = Date.now() - 29 * 24 * 60 * 60 * 1000;
    let lastClose = symbol === 'TSLA' ? 180 : 100;

    for (let index = 0; index < 30; index++) {
      const open = lastClose;
      const drift = Math.sin(index / 3) * 2 + index * 0.15;
      const close = Number((open + drift).toFixed(2));
      const high = Number((Math.max(open, close) + 1.8).toFixed(2));
      const low = Number((Math.min(open, close) - 1.5).toFixed(2));
      const volume = 100000 + index * 2500;

      data.push({
        time: baseTime + index * 24 * 60 * 60 * 1000,
        open: Number(open.toFixed(2)),
        high,
        low,
        close,
        volume,
      });

      lastClose = close;
    }

    return data;
  }

  private registerEventForwarders(): void {
    if (this.eventForwarders.length > 0) {
      return;
    }

    const eventsToForward = [
      EVENTS.TASK_STARTED,
      EVENTS.TASK_STEP_COMPLETED,
      EVENTS.TASK_COMPLETED,
      EVENTS.TASK_FAILED,
      EVENTS.TASK_PAUSED,
      EVENTS.TASK_STATUS_CHANGED,
      EVENTS.STOCK_DATA_UPDATE,
      EVENTS.STOCK_REALTIME_TICK,
      IPC_CHANNELS.ALERT_PUSHED,
    ];

    this.eventForwarders = eventsToForward.map((event) => {
      const listener = (payload: unknown) => {
        this.windowManager.broadcast(event, payload);
      };
      this.eventBus.on(event, listener);
      return { event, listener };
    });
  }

  private async getStockHistory(params: {
    symbol: string;
    timeframe: string;
    sourceConfig?: DataSourceConfig;
  }): Promise<OHLCVData[]> {
    const { symbol, timeframe, sourceConfig } = params;
    let data: OHLCVData[];
    let source: 'demo' | 'live';

    if (sourceConfig) {
      data = await this.dataSourceManager.fetchHistory(sourceConfig, symbol, {
        interval: timeframe,
      });
      source = 'live';
    } else {
      data = this.createMockStockHistory(symbol);
      source = 'demo';
    }

    this.eventBus.emit(EVENTS.STOCK_DATA_UPDATE, {
      symbol,
      timeframe,
      source,
      data,
    });

    return data;
  }

  private async pickLocalPluginPath(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: '选择本地插件目录',
      buttonLabel: '安装插件',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  private getBrowserSessionPartition(): string | undefined {
    const browserConfig = this.configService.get('modules').browser;
    const configuredPartition = browserConfig?.settings?.sessionPartition;
    return typeof configuredPartition === 'string' && configuredPartition.trim().length > 0
      ? configuredPartition.trim()
      : undefined;
  }

  private getTaskWebContents(tabId?: number): WebContents {
    const view = this.tabManager.getView(tabId);
    if (!view) {
      throw new Error('No active browser tab available for task execution');
    }
    return view.webContents;
  }

  private resolveRendererUrl(module: string): string {
    const installedFeatureUrl = this.featurePackageService.resolveRendererUrl(module);
    if (installedFeatureUrl) {
      return installedFeatureUrl;
    }

    if (
      process.env.NODE_ENV !== 'development' &&
      this.featurePackageService.isManagedModule(module)
    ) {
      throw new Error(`Feature package "${module}" is not installed`);
    }

    return getRendererUrl(module);
  }
}

function normalizeCookieDomains(cookies: Array<{ domain?: string }>): string[] {
  return Array.from(
    new Set(
      cookies
        .map((cookie) => cookie.domain)
        .filter((domain): domain is string => typeof domain === 'string' && domain.length > 0),
    ),
  ).sort();
}

function createHeadlessAutomationPage() {
  return {
    async executeJavaScript<T = unknown>(): Promise<T> {
      return undefined as T;
    },
    async capturePage(): Promise<{ toDataURL(): string }> {
      return {
        toDataURL: () => 'data:image/png;base64,',
      };
    },
  };
}
