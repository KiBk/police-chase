IMAGE ?= registry.kibk.net/apps/police-chase:latest
HEBE_ROOT ?= $(HOME)/hebe
.PHONY: build check serve login logout push publish verify
build:
	npm run build
check: build
	node --check src/app.js
	npm test
serve: build
	npm run serve
login:
	$(HEBE_ROOT)/bin/hebe-registry login
logout:
	$(HEBE_ROOT)/bin/hebe-registry logout
push: check
	IMAGE=$(IMAGE) PLATFORM=linux/amd64 ./scripts/build-and-push-crane.sh
publish:
	$(HEBE_ROOT)/bin/hebe-publish app police-chase --image $(IMAGE) --port 80 --health-path /healthz --public
verify:
	python3 scripts/verify_live.py
