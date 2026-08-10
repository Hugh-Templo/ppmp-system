<?php

namespace App\Services;

use App\Models\App as AppModel;
use App\Models\AppRow;
use App\Models\AppSignatory;
use App\Models\Office;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Font;
use Exception;

class AppExcelExporter
{
    public static function getTemplatesDir(): string
    {
        $dir = base_path('../templates');
        if (!file_exists($dir)) {
            $dir = base_path('templates');
        }
        return $dir;
    }

    public static function getCseTemplate(): string
    {
        return self::getTemplatesDir() . DIRECTORY_SEPARATOR . 'NGPA_CSE-APP.xlsx';
    }

    public static function getNonCseTemplate(): string
    {
        return self::getTemplatesDir() . DIRECTORY_SEPARATOR . 'NGPA_nonCSE-APP.xlsx';
    }

    private static function getAppAndRows(int $fiscalYear): array
    {
        $app = AppModel::where('fiscal_year', $fiscalYear)->first();
        if (!$app) {
            throw new Exception("No consolidated APP found for FY {$fiscalYear}. Run consolidation first.");
        }
        $rows = AppRow::where('app_id', $app->id)->get();
        return [$app, $rows];
    }

    private static function loadAppSignatory(): array
    {
        $row = AppSignatory::find(1);
        if (!$row) {
            return [
                'prepared_by' => '',
                'prepared_by_designation' => '',
                'recommended_by' => '',
                'recommended_by_designation' => '',
                'approved_by_name' => '',
                'approved_by_designation' => '',
            ];
        }
        return [
            'prepared_by' => $row->prepared_by ?? '',
            'prepared_by_designation' => $row->prepared_by_designation ?? '',
            'recommended_by' => $row->recommended_by ?? '',
            'recommended_by_designation' => $row->recommended_by_designation ?? '',
            'approved_by_name' => $row->approved_by_name ?? '',
            'approved_by_designation' => $row->approved_by_designation ?? '',
        ];
    }

    public static function exportCseApp(int $fiscalYear): string
    {
        list($app, $allRows) = self::getAppAndRows($fiscalYear);
        $cseRows = $allRows->filter(fn($r) => (bool)$r->is_cse)->values();

        $template = self::getCseTemplate();
        if (!file_exists($template)) {
            throw new Exception("Template missing: " . $template);
        }

        $spreadsheet = IOFactory::load($template);
        $ws = $spreadsheet->getSheetByName('APP') ?: $spreadsheet->getActiveSheet();

        // Write header
        $ws->setCellValue('C2', 'Ormoc City Government');
        $ws->setCellValue('C3', "ANNUAL PROCUREMENT PLAN FOR FY {$fiscalYear}");
        $ws->setCellValue('C4', "   ✓ INDICATIVE               FINAL               UPDATED");

        $dataStart = 29;
        $itemsCount = count($cseRows);

        if ($itemsCount > 0) {
            $ws->insertNewRowBefore($dataStart, $itemsCount);

            foreach ($cseRows as $i => $row) {
                $r = $dataStart + $i;
                $title = $row->description ?? '';
                $qty = $row->quantity_size ?? '';
                $projectDesc = $row->category ?: $title;
                $procurementDesc = $qty ?: $title;

                $ws->setCellValue("A{$r}", "");
                $ws->setCellValue("B{$r}", "");
                $ws->setCellValue("C{$r}", $title);
                $ws->setCellValue("D{$r}", $row->end_user_offices ?? '');
                $ws->setCellValue("E{$r}", $projectDesc);
                $ws->setCellValue("F{$r}", $procurementDesc);
                $ws->setCellValue("G{$r}", $row->procurement_mode ?? '');
                $ws->setCellValue("H{$r}", !empty($row->pre_proc_conf) ? 'Yes' : 'No');
                $ws->setCellValue("I{$r}", "");
                $ws->setCellValue("J{$r}", $row->proc_start ?? '');
                $ws->setCellValue("K{$r}", $row->proc_end ?? '');
                $ws->setCellValue("L{$r}", $row->fund_source ?? '');

                $budget = (float)($row->total_estimated_budget ?? 0);
                $ws->setCellValue("M{$r}", $budget);
                $ws->getStyle("M{$r}")->getNumberFormat()->setFormatCode('#,##0.00');

                $ws->setCellValue("N{$r}", "");
                $ws->setCellValue("O{$r}", $row->delivery_period ?: $qty);
            }
        }

        $sig = self::loadAppSignatory();
        // Prepared by row
        $preparedRow = 35 + $itemsCount;
        if (!empty($sig['prepared_by'])) $ws->setCellValue("C{$preparedRow}", $sig['prepared_by']);
        if (!empty($sig['prepared_by_designation'])) $ws->setCellValue("C" . ($preparedRow + 1), $sig['prepared_by_designation']);
        if (!empty($sig['recommended_by'])) $ws->setCellValue("H{$preparedRow}", $sig['recommended_by']);
        if (!empty($sig['recommended_by_designation'])) $ws->setCellValue("H" . ($preparedRow + 1), $sig['recommended_by_designation']);
        if (!empty($sig['approved_by_name'])) $ws->setCellValue("M{$preparedRow}", $sig['approved_by_name']);
        if (!empty($sig['approved_by_designation'])) $ws->setCellValue("M" . ($preparedRow + 1), $sig['approved_by_designation']);

        $tempFile = tempnam(sys_get_temp_dir(), 'cse_app_');
        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->save($tempFile);

        $content = file_get_contents($tempFile);
        @unlink($tempFile);

        return $content;
    }

    public static function exportNonCseApp(int $fiscalYear): string
    {
        list($app, $allRows) = self::getAppAndRows($fiscalYear);
        $nonCseRows = $allRows->filter(fn($r) => !(bool)$r->is_cse)->values();

        $template = self::getNonCseTemplate();
        if (!file_exists($template)) {
            throw new Exception("Template missing: " . $template);
        }

        $spreadsheet = IOFactory::load($template);
        $ws = $spreadsheet->getActiveSheet();

        $ws->setCellValue('C1', "(Ormoc City Government) Annual Procurement Plan for FY {$fiscalYear}");

        $dataStart = 5;
        $itemsCount = count($nonCseRows);

        if ($itemsCount > 0) {
            $ws->insertNewRowBefore($dataStart, $itemsCount);

            foreach ($nonCseRows as $i => $row) {
                $r = $dataStart + $i;
                $ws->setCellValue("A{$r}", $row->project_type ?? '');
                $ws->setCellValue("B{$r}", $row->description ?? '');
                $ws->setCellValue("C{$r}", $row->end_user_offices ?? '');
                $ws->setCellValue("D{$r}", !empty($row->pre_proc_conf) ? 'Yes' : 'No');
                $ws->setCellValue("E{$r}", $row->procurement_mode ?? '');
                $ws->setCellValue("F{$r}", $row->proc_start ?? '');
                $ws->setCellValue("G{$r}", $row->proc_start ?? '');
                $ws->setCellValue("H{$r}", $row->proc_end ?? '');
                $ws->setCellValue("I{$r}", $row->delivery_period ?? '');
                $ws->setCellValue("J{$r}", $row->fund_source ?? '');
                $ws->setCellValue("K{$r}", "=IF(AND(L{$r}=\"\",M{$r}=\"\"),\"\",SUM(L{$r},M{$r}))");

                $mooe = (float)($row->total_estimated_budget ?? 0);
                $ws->setCellValue("L{$r}", $mooe);
                $ws->getStyle("L{$r}")->getNumberFormat()->setFormatCode('#,##0.00');

                $ws->setCellValue("M{$r}", null);
                $ws->setCellValue("N{$r}", $row->quantity_size ?? '');
            }
        }

        $sig = self::loadAppSignatory();
        $preparedRow = 15 + $itemsCount;
        if (!empty($sig['prepared_by'])) $ws->setCellValue("B{$preparedRow}", $sig['prepared_by']);
        if (!empty($sig['prepared_by_designation'])) $ws->setCellValue("B" . ($preparedRow + 1), $sig['prepared_by_designation']);
        if (!empty($sig['recommended_by'])) $ws->setCellValue("E{$preparedRow}", $sig['recommended_by']);
        if (!empty($sig['recommended_by_designation'])) $ws->setCellValue("E" . ($preparedRow + 1), $sig['recommended_by_designation']);
        if (!empty($sig['approved_by_name'])) $ws->setCellValue("K{$preparedRow}", $sig['approved_by_name']);
        if (!empty($sig['approved_by_designation'])) $ws->setCellValue("K" . ($preparedRow + 1), $sig['approved_by_designation']);

        $tempFile = tempnam(sys_get_temp_dir(), 'noncse_app_');
        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->save($tempFile);

        $content = file_get_contents($tempFile);
        @unlink($tempFile);

        return $content;
    }
}
