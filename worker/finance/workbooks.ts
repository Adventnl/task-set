import ExcelJS from 'exceljs'
import type { FinanceWorkbookPreview } from '../../src/shared/types/finance'

export async function previewWorkbook(
  bytes: ArrayBuffer,
): Promise<FinanceWorkbookPreview> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  return {
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      totalRows: sheet.rowCount,
      rows: Array.from({ length: Math.min(100, sheet.rowCount) }, (_, i) =>
        Array.from(
          { length: Math.min(20, sheet.columnCount) },
          (_, j) => sheet.getRow(i + 1).getCell(j + 1).text,
        ),
      ),
    })),
  }
}
