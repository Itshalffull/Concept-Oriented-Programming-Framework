// Auto-generated entrypoint for kit "copf-devtools", target "cli"
import { Command } from 'commander';
import { SpecParserCommand } from './SpecParser/SpecParser.command';
import { SchemaGenCommand } from './SchemaGen/SchemaGen.command';
import { SyncParserCommand } from './SyncParser/SyncParser.command';
import { SyncCompilerCommand } from './SyncCompiler/SyncCompiler.command';
import { FlowTraceCommand } from './FlowTrace/FlowTrace.command';
import { DeploymentValidatorCommand } from './DeploymentValidator/DeploymentValidator.command';
import { MigrationCommand } from './Migration/Migration.command';
import { ProjectScaffoldCommand } from './ProjectScaffold/ProjectScaffold.command';
import { DevServerCommand } from './DevServer/DevServer.command';
import { CacheCompilerCommand } from './CacheCompiler/CacheCompiler.command';
import { KitManagerCommand } from './KitManager/KitManager.command';

const program = new Command();

  program.addCommand(SpecParserCommand);
  program.addCommand(SchemaGenCommand);
  program.addCommand(SyncParserCommand);
  program.addCommand(SyncCompilerCommand);
  program.addCommand(FlowTraceCommand);
  program.addCommand(DeploymentValidatorCommand);
  program.addCommand(MigrationCommand);
  program.addCommand(ProjectScaffoldCommand);
  program.addCommand(DevServerCommand);
  program.addCommand(CacheCompilerCommand);
  program.addCommand(KitManagerCommand);

export default program;
