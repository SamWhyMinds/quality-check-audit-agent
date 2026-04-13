"""CLI command: audit-agent report"""
import click


@click.command("report")
@click.option("--audit-id", "-a", required=True, help="Audit UUID")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "html", "csv"]), default="html")
@click.option("--output", "-o", required=True, help="Output file path")
def report_command(audit_id, fmt, output):
    """Export a report from a completed audit."""
    import json
    from ...app.database import SessionLocal
    from ...app.services.report_generator import build_report, report_to_csv, report_to_html

    db = SessionLocal()
    try:
        report = build_report(db, audit_id)
        if fmt == "json":
            with open(output, "w", encoding="utf-8") as f:
                json.dump(report.model_dump(mode="json"), f, indent=2, default=str)
        elif fmt == "html":
            with open(output, "w", encoding="utf-8") as f:
                f.write(report_to_html(report))
        elif fmt == "csv":
            with open(output, "w", encoding="utf-8") as f:
                f.write(report_to_csv(report))
        click.echo(f"Report saved to: {output}")
    finally:
        db.close()
