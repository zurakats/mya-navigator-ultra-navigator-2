import { prisma } from '../prisma';
import { DataLoader } from './DataLoader';
import { RaptorData } from './types';

const globalForRaptor = global as unknown as { raptorData: RaptorData };

let raptorDataPromise: Promise<RaptorData> | null = null;

export async function getRaptorData(): Promise<RaptorData> {
  if (globalForRaptor.raptorData) {
    return globalForRaptor.raptorData;
  }

  if (!raptorDataPromise) {
    const loader = new DataLoader(prisma, 500);
    raptorDataPromise = loader.loadData().then(data => {
      if (process.env.NODE_ENV !== 'production') {
        globalForRaptor.raptorData = data;
      }
      return data;
    });
  }

  return raptorDataPromise;
}
