"""
Audit Agent CLI entry point.

Usage:
  audit-agent audit --evidence ./evidence_folder --domains all
  audit-agent report --audit-id <uuid> --format html --output report.html
  audit-agent domains --list
  audit-agent questions --domain D01
"""
import click
from .commands.audit import audit_command
from .commands.report import report_command
from .commands.framework import domains_command, questions_command


@click.group()
@click.version_option(version="1.0.0", prog_name="audit-agent")
def cli():
    """Audit Agent — AI-powered evidence auditing using the 19-domain framework."""
    pass


cli.add_command(audit_command)
cli.add_command(report_command)
cli.add_command(domains_command)
cli.add_command(questions_command)


if __name__ == "__main__":
    cli()
