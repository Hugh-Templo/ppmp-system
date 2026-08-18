<?php

namespace App\Services;

use App\Models\Office;
use App\Models\Ppmp;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Font;
use Exception;

class PpmpExcelExporter
{
    const PPMP_SHEET = "Indicative PPMP (2)";
    const CELL_PREPARED_NAME = "B28";
    const CELL_PREPARED_DESIG = "B29";
    const CELL_PREPARED_UNIT = "B30";
    const CELL_SUBMITTED_NAME = "E28";
    const CELL_SUBMITTED_DESIG = "E29";
    const CELL_SUBMITTED_UNIT = "E30";
    const CELL_UNIT_HEADER = "A11";
    const CELL_FISCAL_YEAR = "A10";

    const ITEM_START_ROW = 18;
    const ITEM_END_ROW = 22;
    const TOTAL_ROW = 23;
    const GUIDE_ROW = 17;
    const MARK_INDICATIVE = "F7";
    const MARK_FINAL = "H7";

    public static function getMasterTemplatePath(): string
    {
        return base_path('../templates/NGPA_PPMP.xlsx');
    }

    public static function getEndUsersDir(): string
    {
        return base_path('../templates/end-users');
    }

    public static function safeDirName(?string $code): string
    {
        $cleaned = preg_replace('/[^A-Za-z0-9_\-]+/', '_', trim($code ?? ''));
        return $cleaned ?: 'office';
    }

    public static function officeTemplatePath(Office $office): string
    {
        return self::getEndUsersDir() . DIRECTORY_SEPARATOR . self::safeDirName($office->code) . DIRECTORY_SEPARATOR . 'NGPA_PPMP.xlsx';
    }

    public static function ensureOfficeTemplate(Office $office): string
    {
        $master = self::getMasterTemplatePath();
        if (!file_exists($master)) {
            // Check fallback path relative to base_path
            $master = base_path('templates/NGPA_PPMP.xlsx');
        }

        if (!file_exists($master)) {
            throw new Exception("Master PPMP template missing at " . $master);
        }

        $dest = self::officeTemplatePath($office);
        $dir = dirname($dest);

        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        if (!file_exists($dest)) {
            copy($master, $dest);
        }

        return $dest;
    }

    public static function writeSignatory(Office $office): string
    {
        $dest = self::ensureOfficeTemplate($office);

        $spreadsheet = IOFactory::load($dest);
        $ws = $spreadsheet->getSheetByName(self::PPMP_SHEET) ?: $spreadsheet->getActiveSheet();

        $officeName = $office->name ?? '';

        $ws->setCellValue(self::CELL_UNIT_HEADER, "End-User or Implementing Unit: {$officeName}");
        $ws->setCellValue(self::CELL_PREPARED_NAME, $office->prepared_by ?? '');
        $ws->setCellValue(self::CELL_PREPARED_DESIG, $office->prepared_by_designation ?? '');
        $ws->setCellValue(self::CELL_PREPARED_UNIT, $officeName);

        $ws->setCellValue(self::CELL_SUBMITTED_NAME, $office->submitted_by ?? '');
        $ws->setCellValue(self::CELL_SUBMITTED_DESIG, $office->submitted_by_designation ?? '');
        $ws->setCellValue(self::CELL_SUBMITTED_UNIT, $officeName ? mb_strtoupper("Head of {$officeName}", 'UTF-8') : '');

        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->save($dest);

        return $dest;
    }

    public static function exportPpmpXlsx(Office $office, Ppmp $ppmp, $items): string
    {
        $dest = self::ensureOfficeTemplate($office);
        self::writeSignatory($office);

        $spreadsheet = IOFactory::load($dest);
        $ws = $spreadsheet->getSheetByName(self::PPMP_SHEET) ?: $spreadsheet->getActiveSheet();

        $officeName = $office->name ?? '';
        $fiscalYear = $ppmp->fiscal_year ?? '';
        $ws->setCellValue(self::CELL_UNIT_HEADER, "End-User or Implementing Unit: {$officeName}");
        $ws->setCellValue(self::CELL_FISCAL_YEAR, "Fiscal Year : {$fiscalYear}");

        $isFinal = strtolower(trim($ppmp->status ?? '')) === 'approved';
        if ($isFinal) {
            $ws->setCellValue(self::MARK_INDICATIVE, " INDICATIVE");
            $ws->setCellValue(self::MARK_FINAL, "✓ FINAL");
        } else {
            $ws->setCellValue(self::MARK_INDICATIVE, "✓ INDICATIVE");
            $ws->setCellValue(self::MARK_FINAL, "FINAL");
        }

        // Clear guide row (cols 1–13)
        for ($c = 1; $c <= 13; $c++) {
            $ws->setCellValueByColumnAndRow($c, self::GUIDE_ROW, null);
        }

        $itemsList = is_array($items) ? $items : $items->toArray();
        $itemsCount = count($itemsList);
        $templateSlots = self::ITEM_END_ROW - self::ITEM_START_ROW + 1;
        $extra = max(0, $itemsCount - $templateSlots);

        if ($extra > 0) {
            $ws->insertNewRowBefore(self::ITEM_END_ROW + 1, $extra);
        }

        $lastDataRow = self::ITEM_START_ROW + max($itemsCount, $templateSlots) - 1;
        for ($idx = 0; $idx <= ($lastDataRow - self::ITEM_START_ROW); $idx++) {
            $row = self::ITEM_START_ROW + $idx;
            if ($idx < $itemsCount) {
                $item = (object)$itemsList[$idx];
                $desc = !empty($item->category) ? $item->category : ($item->description ?? '');
                $qtySize = !empty($item->quantity_size) ? $item->quantity_size : trim(($item->quantity ?? '') . ' ' . ($item->unit_of_measure ?? '') . ' ' . ($item->description ?? ''));

                $ws->setCellValueByColumnAndRow(1, $row, $desc);
                $ws->setCellValueByColumnAndRow(2, $row, $item->project_type ?? '');
                $ws->setCellValueByColumnAndRow(3, $row, $qtySize);
                $ws->setCellValueByColumnAndRow(4, $row, $item->procurement_mode ?? '');
                $ws->setCellValueByColumnAndRow(5, $row, !empty($item->pre_proc_conf) ? 'Yes' : 'No');
                $ws->setCellValueByColumnAndRow(6, $row, $item->proc_start ?? '');
                $ws->setCellValueByColumnAndRow(7, $row, $item->proc_end ?? '');
                $ws->setCellValueByColumnAndRow(8, $row, $item->delivery_period ?? '');
                $ws->setCellValueByColumnAndRow(9, $row, $item->fund_source ?? '');

                $budget = (float)($item->estimated_budget ?? 0);
                $cell = $ws->getCellByColumnAndRow(10, $row);
                $cell->setValue($budget);
                $ws->getStyleByColumnAndRow(10, $row)->getNumberFormat()->setFormatCode('#,##0.00');

                $ws->setCellValueByColumnAndRow(11, $row, $item->supporting_docs ?? '');
                $ws->setCellValueByColumnAndRow(12, $row, $item->remarks ?? '');
                $ws->setCellValueByColumnAndRow(13, $row, !empty($item->is_cse) ? 'CSE' : 'NON-CSE');
            } else {
                for ($c = 1; $c <= 13; $c++) {
                    $ws->setCellValueByColumnAndRow($c, $row, null);
                }
            }
        }

        $totalRow = self::TOTAL_ROW + $extra;
        $totalBudget = array_reduce($itemsList, function ($sum, $it) {
            return $sum + (float)((is_array($it) ? $it['estimated_budget'] : $it->estimated_budget) ?? 0);
        }, 0.0);

        $ws->setCellValueByColumnAndRow(9, $totalRow, "TOTAL BUDGET:");
        $totalCell = $ws->getCellByColumnAndRow(10, $totalRow);
        $totalCell->setValue($totalBudget);
        $ws->getStyleByColumnAndRow(10, $totalRow)->getNumberFormat()->setFormatCode('#,##0.00');
        $ws->getStyleByColumnAndRow(10, $totalRow)->getFont()->setBold(true);

        $tempFile = tempnam(sys_get_temp_dir(), 'ppmp_exp_');
        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->save($tempFile);

        $content = file_get_contents($tempFile);
        @unlink($tempFile);

        return $content;
    }
}
