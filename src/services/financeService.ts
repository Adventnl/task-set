import {
  readFinancePreferences,
  writeFinancePreferences,
  getFinanceReports,
  generateFinanceInsight,
  getFinanceWorkbookPreview,
  matchFinanceReceipt,
  restoreFinanceBackup,
  getRecurring,
  uploadReceipt,
  downloadFinanceReport,
  enableFinancePush,
  getFinance,
  getFinanceMetrics,
  getFinanceTransaction,
  getFinanceTransactions,
  postFinance,
  saveFinanceReview,
} from '../connectors/financeConnector'
import {
  financePreferences,
  selectedFinancePeriod,
} from '../shared/utils/financePreferences'
import type { FinanceFilter } from '../shared/types/finance'
export const financeService = {
  preferences: () => financePreferences(readFinancePreferences()),
  savePreferences: (filter: FinanceFilter) =>
    writeFinancePreferences({
      filter: { ...filter, page: 0 },
      period: selectedFinancePeriod(filter),
    }),
  reports: getFinanceReports,
  insight: generateFinanceInsight,
  preview: getFinanceWorkbookPreview,
  matchReceipt: matchFinanceReceipt,
  load: getFinance,
  restore: restoreFinanceBackup,
  recurring: getRecurring,
  upload: uploadReceipt,
  metrics: getFinanceMetrics,
  list: getFinanceTransactions,
  transaction: getFinanceTransaction,
  save: saveFinanceReview,
  command: postFinance,
  enablePush: enableFinancePush,
  export: downloadFinanceReport,
}
