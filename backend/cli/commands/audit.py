"""CLI command: audit-agent audit"""
import os
import json
import sys
import click


@click.command("audit")
@click.option("--evidence", "-e", required=True, type=click.Path(exists=True),
              help="Path to folder containing evidence files")
@click.option("--domains", "-d", default="all",
              help="Comma-separated domain IDs (e.g. D01,D06,D19) or 'all'")
@click.option("--name", "-n", default=None, help="Audit name (defaults to folder name)")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "html", "csv"]), default="json",
              help="Output format")
@click.option("--output", "-o", default="./audit_report", help="Output file path (without extension)")
def audit_command(evidence, domains, name, fmt, output):
    """Run a full audit against a folder of evidence files."""
    from pathlib import Path
    from ...app.config import get_settings
    from ...app.database import SessionLocal, init_db
    from ...app.models.audit import Audit, EvidenceFile
    from ...app.services.audit_engine import run_audit
    from ...app.services.report_generator import build_report, report_to_csv, report_to_html
    from ...app.parsers.registry import SUPPORTED_EXTENSIONS
    import uuid

    settings = get_settings()
    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)

    audit_name = name or Path(evidence).name or "CLI Audit"

    # Resolve domains
    if domains.lower() == "all":
        selected = [f"D{i:02d}" for i in range(1, 20)]
    else:
        selected = [d.strip().upper() for d in domains.split(",")]

    click.echo(f"Starting audit: {audit_name}")
    click.echo(f"Evidence folder: {evidence}")
    click.echo(f"Domains: {', '.join(selected)}")

    db = SessionLocal()
    try:
        # Create audit record
        audit = Audit(
            id=str(uuid.uuid4()),
            name=audit_name,
            selected_domains=json.dumps(selected),
            status="pending",
        )
        db.add(audit)
        db.commit()

        # Copy evidence files to upload dir
        supported = set()
        for root, _, files in os.walk(evidence):
            for fname in files:
                ext = Path(fname).suffix.lower()
                if ext in SUPPORTED_EXTENSIONS:
                    src = os.path.join(root, fname)
                    stored = f"{uuid.uuid4()}{ext}"
                    dst = os.path.join(settings.upload_dir, stored)
                    import shutil
                    shutil.copy2(src, dst)
                    ef = EvidenceFile(
                        audit_id=audit.id,
                        original_filename=fname,
                        stored_filename=stored,
                        file_type=ext.lstrip("."),
                        file_size_bytes=os.path.getsize(src),
                    )
                    db.add(ef)
                    supported.add(fname)
        db.commit()
        click.echo(f"Uploaded {len(supported)} evidence files")

        # Run audit (synchronously for CLI)
        click.echo("Running audit analysis (this may take several minutes)...")
        run_audit(audit.id)

        # Export report
        report = build_report(db, audit.id)
        output_path = output if output.endswith(f".{fmt}") else f"{output}.{fmt}"
        if fmt == "json":
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report.model_dump(mode="json"), f, indent=2, default=str)
        elif fmt == "html":
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report_to_html(report))
        elif fmt == "csv":
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report_to_csv(report))

        click.echo(f"\nAudit complete!")
        click.echo(f"  Overall score: {report.overall_score}%")
        click.echo(f"  Compliant: {report.compliant_count} | Partial: {report.partial_count} | Non-compliant: {report.non_compliant_count}")
        click.echo(f"  Report saved to: {output_path}")

    finally:
        db.close()
