"""CLI command: audit-agent domains / questions"""
import click


@click.command("domains")
@click.option("--list", "do_list", is_flag=True, default=False, help="List all 19 domains")
@click.option("--id", "domain_id", default=None, help="Show detail for a domain (e.g. D01)")
def domains_command(do_list, domain_id):
    """Browse audit framework domains."""
    from ...app.services.framework_engine import get_all_domains, get_domain

    if domain_id:
        domain = get_domain(domain_id.upper())
        if not domain:
            click.echo(f"Domain {domain_id} not found", err=True)
            return
        click.echo(f"\n{domain.id}: {domain.name}")
        click.echo(f"\nKey Controls ({len(domain.key_controls)}):")
        for c in domain.key_controls:
            click.echo(f"  • {c}")
        click.echo(f"\nKeywords: {', '.join(domain.keywords)}")
        click.echo(f"\nAudit Questions ({len(domain.audit_questions)}):")
        for q in domain.audit_questions:
            click.echo(f"  {q.id}: {q.text}")
    else:
        domains = get_all_domains()
        click.echo(f"\n{'ID':<6} {'Domain Name':<50} {'Questions'}")
        click.echo("-" * 65)
        for d in domains:
            click.echo(f"{d.id:<6} {d.name:<50} {len(d.audit_questions)}")


@click.command("questions")
@click.option("--domain", "-d", default=None, help="Filter by domain ID")
def questions_command(domain):
    """List audit questions."""
    from ...app.services.framework_engine import get_all_domains, get_domain

    if domain:
        d = get_domain(domain.upper())
        domains = [d] if d else []
    else:
        domains = get_all_domains()

    for d in domains:
        if not d:
            continue
        click.echo(f"\n── {d.id}: {d.name}")
        for q in d.audit_questions:
            click.echo(f"  {q.id}: {q.text}")
