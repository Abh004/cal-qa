#!/usr/bin/env bash
# Writes docker/.env with fresh throwaway secrets for a local or CI test instance.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env && "${1:-}" != "--force" ]]; then
  echo "docker/.env already exists (use --force to regenerate)"
  exit 0
fi

read -r VAPID_PUBLIC VAPID_PRIVATE < <(node -e '
  const { generateKeyPairSync } = require("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" }), priv = privateKey.export({ format: "jwk" });
  const b = (s) => Buffer.from(s, "base64url");
  const raw = Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]);
  console.log(raw.toString("base64url"), priv.d);
')

cat > .env <<EOF
NEXTAUTH_SECRET=$(openssl rand -base64 32)
CALENDSO_ENCRYPTION_KEY=$(openssl rand -base64 24)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${VAPID_PUBLIC}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE}
EMAIL_FROM=notifications@cal-qa.test
EOF
echo "wrote docker/.env"
