<?php

namespace App\Services;

use App\Models\App as AppModel;
use App\Models\AppRow;
use App\Models\AppSignatory;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Exception;
use ZipArchive;

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
        $dir = self::getTemplatesDir();
        $preferred = $dir . DIRECTORY_SEPARATOR . 'APP-CSE 2027 Form .xlsx';
        if (file_exists($preferred)) {
            return $preferred;
        }

        foreach (glob($dir . DIRECTORY_SEPARATOR . 'APP-CSE*2027*.xlsx') ?: [] as $match) {
            return $match;
        }

        return $dir . DIRECTORY_SEPARATOR . 'NGPA_CSE-APP.xlsx';
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
        [, $allRows] = self::getAppAndRows($fiscalYear);
        $cseRows = $allRows->filter(fn($r) => (bool)$r->is_cse)->values();

        $template = self::getCseTemplate();
        if (!file_exists($template)) {
            throw new Exception("Template missing: " . $template);
        }

        $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cse_app_' . uniqid('', true) . '.xlsx';
        if (!@copy($template, $tmp)) {
            throw new Exception('Could not copy APP-CSE 2027 template.');
        }

        $zip = new ZipArchive();
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);
            throw new Exception('Could not open APP-CSE 2027 template.');
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $stringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($sheetXml === false || $stringsXml === false) {
            $zip->close();
            @unlink($tmp);
            throw new Exception('APP-CSE 2027 template is missing worksheet data.');
        }

        $catalogIndex = self::buildCse2027CatalogIndexFromXml($sheetXml, $stringsXml);
        $qtyByRow = [];

        foreach ($cseRows as $row) {
            $excelRow = self::matchCse2027CatalogRow($row, $catalogIndex);
            if ($excelRow === null) {
                continue;
            }

            $qty = self::cseQuarterQuantities($row);
            if (!isset($qtyByRow[$excelRow])) {
                $qtyByRow[$excelRow] = [
                    'q1' => 0,
                    'q2' => 0,
                    'q3' => 0,
                    'q4' => 0,
                    'unit_cost' => null,
                    'catalog_price' => $catalogIndex['price'][$excelRow] ?? 0,
                ];
            }
            $qtyByRow[$excelRow]['q1'] += $qty['q1'];
            $qtyByRow[$excelRow]['q2'] += $qty['q2'];
            $qtyByRow[$excelRow]['q3'] += $qty['q3'];
            $qtyByRow[$excelRow]['q4'] += $qty['q4'];
            if ($qtyByRow[$excelRow]['unit_cost'] === null && $row->unit_cost) {
                $qtyByRow[$excelRow]['unit_cost'] = (float) $row->unit_cost;
            }
        }

        $writes = [
            'D23' => ['text', 'Ormoc City Government'],
            'D24' => ['text', 'VIII'],
            'D25' => ['text', 'Ormoc City, Leyte'],
            'J24' => ['text', 'LGU'],
        ];

        foreach ($qtyByRow as $r => $qty) {
            if ($qty['q1'] > 0) {
                $writes["E{$r}"] = ['number', $qty['q1']];
            }
            if ($qty['q2'] > 0) {
                $writes["J{$r}"] = ['number', $qty['q2']];
            }
            if ($qty['q3'] > 0) {
                $writes["O{$r}"] = ['number', $qty['q3']];
            }
            if ($qty['q4'] > 0) {
                $writes["T{$r}"] = ['number', $qty['q4']];
            }
            if (($qty['catalog_price'] ?? 0) <= 0 && $qty['unit_cost']) {
                $writes["Z{$r}"] = ['number', $qty['unit_cost']];
            }
        }

        $sig = self::loadAppSignatory();
        if (!empty($sig['prepared_by'])) {
            $writes['B483'] = ['text', $sig['prepared_by']];
        }
        if (!empty($sig['recommended_by'])) {
            $writes['H483'] = ['text', $sig['recommended_by']];
        }
        if (!empty($sig['approved_by_name'])) {
            $writes['U483'] = ['text', $sig['approved_by_name']];
        }

        foreach ($writes as $ref => [$kind, $value]) {
            if ($kind === 'text') {
                self::writeSheetTextCell($sheetXml, $ref, (string) $value);
            } else {
                self::writeSheetNumericCell($sheetXml, $ref, $value);
            }
        }

        $zip->deleteName('xl/worksheets/sheet1.xml');
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
        if ($zip->close() !== true) {
            @unlink($tmp);
            throw new Exception('Could not save APP-CSE 2027 Excel file.');
        }

        $content = file_get_contents($tmp);
        @unlink($tmp);

        if ($content === false || !self::isExcelBinary($content)) {
            throw new Exception('Failed to build a valid APP-CSE 2027 Excel file.');
        }

        return $content;
    }

    public static function isExcelBinary(string $bytes): bool
    {
        if (strlen($bytes) < 4) {
            return false;
        }
        $magic = substr($bytes, 0, 4);
        return $magic === "PK\x03\x04"
            || $magic === "PK\x05\x06"
            || $magic === "\xD0\xCF\x11\xE0";
    }

    public static function excelDownload($content, string $filename, string $mime)
    {
        $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'appbac_dl_' . uniqid('', true) . '.xlsx';
        if (file_put_contents($tmp, $content) === false) {
            throw new Exception('Could not prepare Excel download.');
        }

        return response()->download($tmp, $filename, [
            'Content-Type' => $mime,
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ])->deleteFileAfterSend(true);
    }

    private static function parseSharedStrings(string $xml): array
    {
        $out = [];
        $ss = @simplexml_load_string($xml);
        if (!$ss) {
            return $out;
        }
        foreach ($ss->si as $si) {
            $text = '';
            if (isset($si->t)) {
                $text = (string) $si->t;
            } else {
                foreach ($si->r as $run) {
                    $text .= (string) $run->t;
                }
            }
            $out[] = $text;
        }
        return $out;
    }

    private static function cellDecoded($cell, array $strings): string
    {
        $t = (string) $cell['t'];
        if ($t === 's' && isset($cell->v)) {
            return (string) ($strings[(int) $cell->v] ?? '');
        }
        if ($t === 'inlineStr' && isset($cell->is->t)) {
            return (string) $cell->is->t;
        }
        if (isset($cell->v)) {
            return (string) $cell->v;
        }
        return '';
    }

    /**
     * @return array{by_desc: array<string, int[]>, by_code: array<string, int[]>, items: array<int, array{row:int, desc:string, code:string}>, price: array<int, float>}
     */
    private static function buildCse2027CatalogIndexFromXml(string $sheetXml, string $stringsXml): array
    {
        $strings = self::parseSharedStrings($stringsXml);
        $sheet = @simplexml_load_string($sheetXml);
        $byDesc = [];
        $byCode = [];
        $items = [];
        $price = [];

        if (!$sheet) {
            return ['by_desc' => [], 'by_code' => [], 'items' => [], 'price' => []];
        }

        foreach ($sheet->sheetData->row as $row) {
            $r = (int) $row['r'];
            if ($r < 32 || $r > 463) {
                continue;
            }

            $code = '';
            $desc = '';
            $unitPrice = 0.0;
            foreach ($row->c as $cell) {
                $ref = (string) $cell['r'];
                if (!preg_match('/^([A-Z]+)(\d+)$/', $ref, $m)) {
                    continue;
                }
                $col = $m[1];
                $value = self::cellDecoded($cell, $strings);
                if ($col === 'B') {
                    $code = trim($value);
                } elseif ($col === 'C') {
                    $desc = trim($value);
                } elseif ($col === 'Z') {
                    $unitPrice = is_numeric($value) ? (float) $value : 0.0;
                }
            }

            if ($code === '' || $desc === '') {
                continue;
            }

            $descKey = self::normalizeCseKey($desc);
            $codeKey = self::normalizeCseKey($code);
            $byDesc[$descKey][] = $r;
            $byCode[$codeKey][] = $r;
            $items[] = [
                'row' => $r,
                'desc' => $descKey,
                'code' => $codeKey,
            ];
            $price[$r] = $unitPrice;
        }

        return [
            'by_desc' => $byDesc,
            'by_code' => $byCode,
            'items' => $items,
            'price' => $price,
        ];
    }

    private static function writeSheetNumericCell(string &$xml, string $ref, $value): void
    {
        $n = is_int($value) || (is_numeric($value) && floor((float) $value) == $value)
            ? (string) (int) $value
            : rtrim(rtrim(sprintf('%.10F', (float) $value), '0'), '.');
        self::replaceSheetCell($xml, $ref, function (string $attrs) use ($ref, $n) {
            $attrs = preg_replace('/\s+t="[^"]*"/', '', $attrs) ?? $attrs;
            return '<c r="' . $ref . '"' . $attrs . '><v>' . $n . '</v></c>';
        });
    }

    private static function writeSheetTextCell(string &$xml, string $ref, string $text): void
    {
        $escaped = htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        self::replaceSheetCell($xml, $ref, function (string $attrs) use ($ref, $escaped) {
            $attrs = preg_replace('/\s+t="[^"]*"/', '', $attrs) ?? $attrs;
            return '<c r="' . $ref . '"' . $attrs . ' t="inlineStr"><is><t xml:space="preserve">' . $escaped . '</t></is></c>';
        });
    }

    private static function replaceSheetCell(string &$xml, string $ref, callable $builder): void
    {
        $quoted = preg_quote($ref, '/');
        $pattern = '/<c r="' . $quoted . '"([^>]*)\/>|<c r="' . $quoted . '"([^>]*)>.*?<\/c>/s';
        $xml = preg_replace_callback($pattern, function ($m) use ($builder) {
            $attrs = ($m[1] ?? '') !== '' ? $m[1] : ($m[2] ?? '');
            return $builder($attrs);
        }, $xml, 1);
    }

    private static function normalizeCseKey(?string $value): string
    {
        $value = strtoupper(trim((string) $value));
        $value = preg_replace('/[^A-Z0-9]+/', ' ', $value) ?? $value;
        return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
    }

    private static function matchCse2027CatalogRow($row, array $index): ?int
    {
        $descKey = self::normalizeCseKey($row->description ?? '');
        if ($descKey === '') {
            return null;
        }

        if (isset($index['by_desc'][$descKey]) && count($index['by_desc'][$descKey]) === 1) {
            return $index['by_desc'][$descKey][0];
        }

        if (isset($index['by_code'][$descKey]) && count($index['by_code'][$descKey]) === 1) {
            return $index['by_code'][$descKey][0];
        }

        $hits = [];
        foreach ($index['items'] as $item) {
            if ($item['desc'] === $descKey || $item['code'] === $descKey) {
                $hits[$item['row']] = true;
                continue;
            }
            if ($item['desc'] !== '' && (str_contains($descKey, $item['desc']) || str_contains($item['desc'], $descKey))) {
                $hits[$item['row']] = true;
            }
        }

        $rows = array_keys($hits);
        return count($rows) === 1 ? $rows[0] : null;
    }

    /**
     * APP-CSE 2027 uses monthly qty. PPMP data is quarterly, so Q1..Q4
     * are written to January, April, July, and October.
     *
     * @return array{q1:int,q2:int,q3:int,q4:int}
     */
    private static function cseQuarterQuantities($row): array
    {
        $q1 = (int) ($row->q1_qty ?? 0);
        $q2 = (int) ($row->q2_qty ?? 0);
        $q3 = (int) ($row->q3_qty ?? 0);
        $q4 = (int) ($row->q4_qty ?? 0);
        $total = (int) ($row->total_quantity ?? 0);

        if ($q1 + $q2 + $q3 + $q4 === 0 && $total > 0) {
            $q1 = $total;
        }

        return ['q1' => $q1, 'q2' => $q2, 'q3' => $q3, 'q4' => $q4];
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

        $tempFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'noncse_app_' . uniqid('', true) . '.xlsx';
        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->setPreCalculateFormulas(false);
        $writer->save($tempFile);

        $content = file_get_contents($tempFile);
        @unlink($tempFile);

        return $content;
    }
}
