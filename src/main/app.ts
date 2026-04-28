import { app, BrowserWindow, dialog } from 'electron';
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
import { HotReportService } from './services/hot/HotReportService';
import { HotRunProjectionService } from './services/hot/HotRunProjectionService';
import { HotSourceService } from './services/hot/HotSourceService';
import { HotTaskCompiler } from './services/hot/HotTaskCompiler';
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
import { getRendererUrl, getUserDataPath } from './utils/paths';
import {
  AIRepository,
  AlertRepository,
  BatchRepository,
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
  TaskFlow,
} from '@shared/types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

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
    const hotSourceRepository = new HotSourceRepository(this.databaseService);
    const hotReportRepository = new HotReportRepository(this.databaseService);
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
          engine: new AutomationEngine(),
          eventBus: this.eventBus,
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
    this.schedulerService = new SchedulerService({ taskService: this.taskService });
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
      startTask: (taskId: string) => this.taskService.startTask(taskId, this.getTaskWebContents()),
    });
    this.hotReportService = new HotReportService({
      sourceRepository: hotSourceRepository,
      batchService,
      resultService: this.resultService,
      executionLogService: this.executionLogService,
      reportRepository: hotReportRepository,
      outputDir: path.join(getUserDataPath(), 'hot-reports'),
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
      const webContents = this.getTaskWebContents(tabId);
      return this.taskService.startTask(taskId, webContents);
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
      const { tabId } = (params as { tabId?: number }) ?? {};
      return this.tabManager.startRecorder(tabId);
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
