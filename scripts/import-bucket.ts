/**
 * Importa fotos enviadas diretamente na raiz do bucket (uso local/servidor com memória folgada).
 * Em hospedagens pequenas, prefira o botão em Painel → Projetos e galerias.
 *   npm run import:bucket
 */
import "dotenv/config";
import { importBucketRoot, pendingBucketImports } from "@/lib/import-bucket";

async function main() {
  let total = 0;
  for (;;) {
    const pending = await pendingBucketImports();
    if (!pending.length) break;
    const r = await importBucketRoot(1);
    total += r.imported;
    for (const f of r.failed) console.error(`  ✗ ${f}`);
    if (!r.imported && r.failed.length) break;
    console.log(`  ✓ ${total} importada(s)`);
  }
  console.log(`✓ Concluído: ${total} foto(s)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
