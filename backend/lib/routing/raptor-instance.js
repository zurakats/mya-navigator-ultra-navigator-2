"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRaptorData = getRaptorData;
const prisma_1 = require("../prisma");
const DataLoader_1 = require("./DataLoader");
const globalForRaptor = global;
let raptorDataPromise = null;
async function getRaptorData() {
    if (globalForRaptor.raptorData) {
        return globalForRaptor.raptorData;
    }
    if (!raptorDataPromise) {
        const loader = new DataLoader_1.DataLoader(prisma_1.prisma, 500);
        raptorDataPromise = loader.loadData().then(data => {
            if (process.env.NODE_ENV !== 'production') {
                globalForRaptor.raptorData = data;
            }
            return data;
        });
    }
    return raptorDataPromise;
}
