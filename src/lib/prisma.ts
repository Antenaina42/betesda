import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// URL de secours lue depuis l'environnement (jamais de mot de passe en dur dans le code source)
const HOSTINGER_DB_URL =
  process.env.HOSTINGER_DATABASE_URL || 'mysql://root:root@localhost:3306/betesda_db';

export function cleanDatabaseUrl(raw?: string): string {
  if (!raw || !raw.trim()) {
    return HOSTINGER_DB_URL;
  }
  let cleaned = raw.trim();

  // Si l'utilisateur a collé "DATABASE_URL=" dans le champ valeur du panneau
  cleaned = cleaned.replace(/^DATABASE_URL\s*=\s*/i, '').trim();

  // Enlever les guillemets englobants (" ou ') fréquemment insérés par mégarde
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Vérifier à nouveau si "DATABASE_URL=" était entouré de guillemets
  cleaned = cleaned.replace(/^DATABASE_URL\s*=\s*/i, '').trim();
  cleaned = cleaned.replace(/^["']+/, '').replace(/["']+$/, '').trim();

  // Si en production mais pointe encore sur root:root en local
  if (
    process.env.NODE_ENV === 'production' &&
    (cleaned.includes('root:root@localhost:3306/betesda_db') || cleaned.includes('root:root@localhost:3306/myclinique_db'))
  ) {
    return HOSTINGER_DB_URL;
  }

  // Si mysql:// est présent quelque part dans la chaîne (même précédé d'un préfixe parasite)
  const mysqlIndex = cleaned.indexOf('mysql://');
  if (mysqlIndex !== -1) {
    cleaned = cleaned.substring(mysqlIndex);
  } else if (cleaned.startsWith('mysql:')) {
    cleaned = cleaned.replace(/^mysql:(\/*)/, 'mysql://');
  } else if (cleaned.includes('@') && cleaned.includes('/')) {
    cleaned = 'mysql://' + cleaned;
  } else {
    // Valeur non reconnue (ex: texte aléatoire) -> fallback sûr Hostinger
    return HOSTINGER_DB_URL;
  }

  // Nettoyer les guillemets ou espaces résiduels en fin de chaîne
  cleaned = cleaned.replace(/["']+$/, '').trim();

  return cleaned;
}

export function getDatabaseUrl(): string {
  return cleanDatabaseUrl(process.env.DATABASE_URL);
}

function createPrismaClient(): PrismaClient {
  // Synchroniser process.env.DATABASE_URL pour le moteur Rust interne de Prisma
  const activeUrl = getDatabaseUrl();
  process.env.DATABASE_URL = activeUrl;

  return new PrismaClient({
    datasources: {
      db: {
        url: activeUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Initialisation paresseuse (lazy) : évite de charger le moteur natif Prisma/Tokio
// pendant la phase "Collecting page data" de `next build` sur les hébergements mutualisés.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (
      prop === 'then' ||
      prop === 'catch' ||
      prop === 'finally' ||
      prop === '__esModule' ||
      prop === '$$typeof' ||
      prop === 'default' ||
      typeof prop === 'symbol'
    ) {
      return undefined;
    }
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
