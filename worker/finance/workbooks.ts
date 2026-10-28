import ExcelJS from 'exceljs'
import type { FinanceWorkbookPreview } from '../../src/shared/types/finance'

function cellText(cell: ExcelJS.Cell): string {
  if (cell.value instanceof Date)
    return `${cell.value.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  if (typeof cell.value === 'number' && cell.numFmt?.includes('NZ$'))
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
    }).format(cell.value)
  return cell.text
}

export async function previewWorkbook(
  bytes: ArrayBuffer,
  page = 0,
  sheetIndex?: number,
): Promise<FinanceWorkbookPreview> {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    (sheetIndex !== undefined &&
      (!Number.isSafeInteger(sheetIndex) || sheetIndex < 0))
  )
    throw new Error('Invalid workbook page or sheet')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  if (sheetIndex !== undefined && sheetIndex >= workbook.worksheets.length)
    throw new Error('Workbook sheet not found')
  return {
    sheets: workbook.worksheets.map((sheet, index) => {
      const current = Math.min(
        page,
        Math.max(0, Math.ceil((sheet.rowCount - 1) / 50) - 1),
      )
      const row = (i: number) =>
        Array.from({ length: sheet.columnCount }, (_, j) =>
          cellText(sheet.getRow(i).getCell(j + 1)),
        )
      return {
        name: sheet.name,
        totalRows: sheet.rowCount,
        totalColumns: sheet.columnCount,
        page: current,
        rows:
          sheetIndex !== undefined && index !== sheetIndex
            ? []
            : sheet.rowCount
              ? [
                  row(1),
                  ...Array.from(
                    {
                      length: Math.max(
                        0,
                        Math.min(50, sheet.rowCount - 1 - current * 50),
                      ),
                    },
                    (_, i) => row(current * 50 + i + 2),
                  ),
                ]
              : [],
      }
    }),
  }
}
