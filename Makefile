.PHONY: install dev-backend dev-frontend dev setup

setup:
	cp .env.example .env
	@echo "Edit .env and add your ANTHROPIC_API_KEY"

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

install: install-backend install-frontend

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

# Run both in parallel (requires GNU make or similar)
dev:
	@echo "Start backend:  make dev-backend"
	@echo "Start frontend: make dev-frontend"
	@echo "Or use Docker:  docker-compose up"

build-frontend:
	cd frontend && npm run build

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

# CLI usage examples
audit-example:
	cd backend && python -m cli.main audit \
		--evidence ../evidence_folder \
		--domains all \
		--name "Example Audit" \
		--format html \
		--output ../reports/audit
