<?php

namespace App\Services;

use App\Models\App as AppModel;
use App\Models\AppRow;
use App\Models\AppSignatory;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
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

    /**
     * Merge APP rows that share the same description / Procurement Project name
     * so Excel export matches the bacadmin preview (one row, deduped modes).
     *
     * @param  \Illuminate\Support\Collection|array  $rows
     * @return array<int, object>
     */
    private static function mergeAppRowsByDescription($rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            $desc = trim((string) ($row->description ?? ''));
            $key = self::normalizeProcurementProject($desc);
            if ($key === '') {
                $map['__empty_' . count($map)] = clone $row;
                continue;
            }

            if (!isset($map[$key])) {
                $merged = clone $row;
                $merged->project_type = self::uniqueJoinValues($row->project_type ?? null);
                $merged->procurement_mode = self::uniqueProcurementModes($row->procurement_mode ?? null);
                $merged->fund_source = self::uniqueJoinValues($row->fund_source ?? null);
                $merged->quantity_size = self::uniqueJoinValues($row->quantity_size ?? null);
                $merged->delivery_period = self::uniqueJoinValues($row->delivery_period ?? null);
                $merged->end_user_offices = self::uniqueJoinValues($row->end_user_offices ?? null);
                $merged->total_estimated_budget = (float) ($row->total_estimated_budget ?? 0);
                $merged->total_quantity = (int) ($row->total_quantity ?? 0);
                $merged->q1_qty = (int) ($row->q1_qty ?? 0);
                $merged->q2_qty = (int) ($row->q2_qty ?? 0);
                $merged->q3_qty = (int) ($row->q3_qty ?? 0);
                $merged->q4_qty = (int) ($row->q4_qty ?? 0);
                $merged->pre_proc_conf = !empty($row->pre_proc_conf);
                $map[$key] = $merged;
                continue;
            }

            $merged = $map[$key];
            $merged->project_type = self::uniqueJoinValues(
                $merged->project_type ?? null,
                $row->project_type ?? null
            );
            $merged->procurement_mode = self::uniqueProcurementModes(
                $merged->procurement_mode ?? null,
                $row->procurement_mode ?? null
            );
            $merged->fund_source = self::uniqueJoinValues(
                $merged->fund_source ?? null,
                $row->fund_source ?? null
            );
            $merged->quantity_size = self::uniqueJoinValues(
                $merged->quantity_size ?? null,
                $row->quantity_size ?? null
            );
            $merged->delivery_period = self::uniqueJoinValues(
                $merged->delivery_period ?? null,
                $row->delivery_period ?? null
            );
            $merged->end_user_offices = self::uniqueJoinValues(
                $merged->end_user_offices ?? null,
                $row->end_user_offices ?? null
            );
            $merged->proc_start = self::earlierTimeline(
                $merged->proc_start ?? null,
                $row->proc_start ?? null
            );
            $merged->proc_end = self::laterTimeline(
                $merged->proc_end ?? null,
                $row->proc_end ?? null
            );
            if (!empty($row->pre_proc_conf)) {
                $merged->pre_proc_conf = true;
            }
            $merged->total_estimated_budget =
                (float) ($merged->total_estimated_budget ?? 0)
                + (float) ($row->total_estimated_budget ?? 0);
            $merged->total_quantity =
                (int) ($merged->total_quantity ?? 0)
                + (int) ($row->total_quantity ?? 0);
            $merged->q1_qty = (int) ($merged->q1_qty ?? 0) + (int) ($row->q1_qty ?? 0);
            $merged->q2_qty = (int) ($merged->q2_qty ?? 0) + (int) ($row->q2_qty ?? 0);
            $merged->q3_qty = (int) ($merged->q3_qty ?? 0) + (int) ($row->q3_qty ?? 0);
            $merged->q4_qty = (int) ($merged->q4_qty ?? 0) + (int) ($row->q4_qty ?? 0);
            if (empty($merged->unit_of_measure) && !empty($row->unit_of_measure)) {
                $merged->unit_of_measure = $row->unit_of_measure;
            }
            if (($merged->unit_cost === null || $merged->unit_cost === '') && $row->unit_cost) {
                $merged->unit_cost = $row->unit_cost;
            }
        }

        $mergedRows = array_values($map);
        usort($mergedRows, function ($a, $b) {
            return strcasecmp(
                (string) ($a->description ?? ''),
                (string) ($b->description ?? '')
            );
        });

        return $mergedRows;
    }

    /**
     * Export APP-CSE 2027 Excel: always a full copy of the official template
     * (all ~404 catalog items stay visible). Only unlocked monthly qty cells are
     * written for matched verified CSE PPMP lines. Empty catalog rows are never
     * deleted, hidden, or filtered — Q1–Q4 / year qty / year amount remain
     * Excel formulas on every row.
     */
    public static function exportCseApp(int $fiscalYear): string
    {
        $template = self::getCseTemplate();
        if (!file_exists($template)) {
            throw new Exception("Template missing: " . $template);
        }

        // Full template copy — do not build a filled-only workbook.
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
        // Month map per catalog Excel row: [excelRow => [1=>qty ... 12=>qty]]
        $qtyByRow = self::buildCseMonthQtyByCatalogRow($fiscalYear, $catalogIndex);

        $writes = [
            'D23' => ['text', 'Ormoc City Government'],
            'D24' => ['text', 'VIII'],
            'D25' => ['text', 'Ormoc City, Leyte'],
            'J24' => ['text', 'LGU'],
        ];

        // Write qty into matched month cells only. Unmatched catalog rows stay
        // intact (blank qty; formulas still compute 0). Never remove rows.
        foreach ($qtyByRow as $r => $months) {
            foreach ($months as $monthNum => $qty) {
                if ($qty <= 0) {
                    continue;
                }
                $col = CseQtyHelper::MONTH_COLUMNS[(int) $monthNum] ?? null;
                if ($col === null) {
                    continue;
                }
                // Only unlocked monthly qty cells — never overwrite Q1–Q4 formulas or Z unit price.
                $writes["{$col}{$r}"] = ['number', (int) $qty];
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

    /**
     * Build monthly qty per APP-CSE catalog row from approved CSE PPMP items
     * (preferred — correct when the same item spans multiple quarters).
     * Falls back to consolidated app_rows q1–q4 placed in Jan/Apr/Jul/Oct.
     *
     * @param  array<int, string[]>|null  $officesByRow  Optional excelRow => office labels
     * @return array<int, array<int, int>>
     */
    private static function buildCseMonthQtyByCatalogRow(
        int $fiscalYear,
        array $catalogIndex,
        ?array &$officesByRow = null
    ): array {
        $qtyByRow = [];
        if ($officesByRow !== null) {
            $officesByRow = [];
        }

        $ppmps = Ppmp::where('fiscal_year', $fiscalYear)
            ->where('status', 'Approved')
            ->whereNull('superseded_at')
            ->get(['id', 'office_id']);
        $ppmpIds = $ppmps->pluck('id');
        $officeByPpmpId = [];
        if ($officesByRow !== null && $ppmps->isNotEmpty()) {
            $offices = Office::whereIn('id', $ppmps->pluck('office_id')->unique()->filter())
                ->get()
                ->keyBy('id');
            foreach ($ppmps as $ppmp) {
                $office = $offices->get($ppmp->office_id);
                $officeByPpmpId[$ppmp->id] = $office
                    ? (string) ($office->code ?: $office->name)
                    : '';
            }
        }

        $cseItems = $ppmpIds->isEmpty()
            ? collect()
            : PpmpItem::whereIn('ppmp_id', $ppmpIds)->where('is_cse', true)->get();

        if ($cseItems->isNotEmpty()) {
            foreach ($cseItems as $item) {
                $lines = CseQtyHelper::expandCsePpmpItemLines($item);
                if (!$lines) {
                    continue;
                }
                $officeLabel = $officeByPpmpId[$item->ppmp_id] ?? '';
                foreach ($lines as $line) {
                    $excelRow = self::matchCse2027CatalogLine($line, $catalogIndex);
                    if ($excelRow === null) {
                        continue;
                    }
                    if (!isset($qtyByRow[$excelRow])) {
                        $qtyByRow[$excelRow] = CseQtyHelper::emptyMonthMap();
                    }
                    CseQtyHelper::addExpandedLineToMonthMap($qtyByRow[$excelRow], $line);
                    if ($officesByRow !== null && $officeLabel !== '') {
                        if (!isset($officesByRow[$excelRow])) {
                            $officesByRow[$excelRow] = [];
                        }
                        $officesByRow[$excelRow][$officeLabel] = true;
                    }
                }
            }
            return $qtyByRow;
        }

        // Fallback: consolidated APP rows (quarter totals → first month of quarter).
        try {
            [, $allRows] = self::getAppAndRows($fiscalYear);
        } catch (Exception $e) {
            return $qtyByRow;
        }

        $cseRows = self::mergeAppRowsByDescription(
            $allRows->filter(fn ($r) => (bool) $r->is_cse)->values()
        );

        foreach ($cseRows as $row) {
            $excelRow = self::matchCse2027CatalogRow($row, $catalogIndex);
            if ($excelRow === null) {
                continue;
            }
            if (!isset($qtyByRow[$excelRow])) {
                $qtyByRow[$excelRow] = CseQtyHelper::emptyMonthMap();
            }
            $qtyByRow[$excelRow][1] += (int) ($row->q1_qty ?? 0);
            $qtyByRow[$excelRow][4] += (int) ($row->q2_qty ?? 0);
            $qtyByRow[$excelRow][7] += (int) ($row->q3_qty ?? 0);
            $qtyByRow[$excelRow][10] += (int) ($row->q4_qty ?? 0);
            if ($officesByRow !== null && !empty($row->end_user_offices)) {
                foreach (preg_split('/\s*,\s*/', (string) $row->end_user_offices) ?: [] as $officeLabel) {
                    $officeLabel = trim($officeLabel);
                    if ($officeLabel === '') {
                        continue;
                    }
                    if (!isset($officesByRow[$excelRow])) {
                        $officesByRow[$excelRow] = [];
                    }
                    $officesByRow[$excelRow][$officeLabel] = true;
                }
            }
        }

        return $qtyByRow;
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
            'Access-Control-Expose-Headers' => 'Content-Disposition, Content-Type',
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
     * @return array{
     *   by_desc: array<string, int[]>,
     *   by_code: array<string, int[]>,
     *   items: array<int, array{row:int, desc:string, code:string}>,
     *   price: array<int, float>,
     *   uom: array<int, string>,
     *   meta: array<int, array{description:string, uom:string, code:string}>
     * }
     */
    private static function buildCse2027CatalogIndexFromXml(string $sheetXml, string $stringsXml): array
    {
        $strings = self::parseSharedStrings($stringsXml);
        $sheet = @simplexml_load_string($sheetXml);
        $byDesc = [];
        $byCode = [];
        $items = [];
        $price = [];
        $uom = [];
        $meta = [];

        if (!$sheet) {
            return [
                'by_desc' => [],
                'by_code' => [],
                'items' => [],
                'price' => [],
                'uom' => [],
                'meta' => [],
            ];
        }

        foreach ($sheet->sheetData->row as $row) {
            $r = (int) $row['r'];
            if ($r < 32 || $r > 463) {
                continue;
            }

            $code = '';
            $desc = '';
            $measure = '';
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
                } elseif ($col === 'D') {
                    $measure = trim($value);
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
            $uom[$r] = $measure;
            $meta[$r] = [
                'description' => $desc,
                'uom' => $measure,
                'code' => $code,
            ];
        }

        return [
            'by_desc' => $byDesc,
            'by_code' => $byCode,
            'items' => $items,
            'price' => $price,
            'uom' => $uom,
            'meta' => $meta,
        ];
    }

    private static function writeSheetNumericCell(string &$xml, string $ref, $value): void
    {
        $n = is_int($value) || (is_numeric($value) && floor((float) $value) == $value)
            ? (string) (int) $value
            : rtrim(rtrim(sprintf('%.10F', (float) $value), '0'), '.');
        self::upsertSheetCell($xml, $ref, function (string $attrs) use ($ref, $n) {
            $attrs = preg_replace('/\s+t="[^"]*"/', '', $attrs) ?? $attrs;
            return '<c r="' . $ref . '"' . $attrs . '><v>' . $n . '</v></c>';
        });
    }

    private static function writeSheetTextCell(string &$xml, string $ref, string $text): void
    {
        $escaped = htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        self::upsertSheetCell($xml, $ref, function (string $attrs) use ($ref, $escaped) {
            $attrs = preg_replace('/\s+t="[^"]*"/', '', $attrs) ?? $attrs;
            return '<c r="' . $ref . '"' . $attrs . ' t="inlineStr"><is><t xml:space="preserve">' . $escaped . '</t></is></c>';
        });
    }

    private static function excelNumberString($value): string
    {
        return is_int($value) || (is_numeric($value) && floor((float) $value) == $value)
            ? (string) (int) $value
            : rtrim(rtrim(sprintf('%.10F', (float) $value), '0'), '.');
    }

    private static function writeSheetFormulaCell(string &$xml, string $ref, string $formula, $cached = null): void
    {
        $escaped = htmlspecialchars($formula, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $cachedXml = $cached === null || $cached === ''
            ? '<v/>'
            : '<v>' . self::excelNumberString($cached) . '</v>';
        self::upsertSheetCell($xml, $ref, function (string $attrs) use ($ref, $escaped, $cachedXml) {
            $attrs = preg_replace('/\s+t="[^"]*"/', '', $attrs) ?? $attrs;
            return '<c r="' . $ref . '"' . $attrs . '><f>' . $escaped . '</f>' . $cachedXml . '</c>';
        });
    }

    private static function replaceSheetCell(string &$xml, string $ref, callable $builder): int
    {
        $quoted = preg_quote($ref, '/');
        $pattern = '/<c r="' . $quoted . '"([^>]*)\/>|<c r="' . $quoted . '"([^>]*)>.*?<\/c>/s';
        $count = 0;
        $xml = preg_replace_callback($pattern, function ($m) use ($builder) {
            $attrs = ($m[1] ?? '') !== '' ? $m[1] : ($m[2] ?? '');
            return $builder($attrs);
        }, $xml, 1, $count);
        return (int) $count;
    }

    private static function upsertSheetCell(string &$xml, string $ref, callable $builder): void
    {
        if (self::replaceSheetCell($xml, $ref, $builder) > 0) {
            return;
        }
        if (!preg_match('/^([A-Z]+)(\d+)$/', $ref, $m)) {
            return;
        }
        $rowNum = (int) $m[2];
        $cellXml = $builder(' s="16"');
        if (preg_match('/<row r="' . $rowNum . '"[^>]*>/', $xml)) {
            $xml = preg_replace(
                '/(<row r="' . $rowNum . '"[^>]*>)([\s\S]*?)(<\/row>)/',
                '$1$2' . $cellXml . '$3',
                $xml,
                1
            );
            return;
        }
        $rowXml = '<row r="' . $rowNum . '" ht="15" customHeight="1">' . $cellXml . '</row>';
        if (preg_match_all('/<row r="(\d+)"/', $xml, $rows)) {
            foreach ($rows[1] as $existing) {
                if ((int) $existing > $rowNum) {
                    $xml = preg_replace(
                        '/<row r="' . $existing . '"/',
                        $rowXml . '<row r="' . $existing . '"',
                        $xml,
                        1
                    );
                    return;
                }
            }
        }
        $xml = str_replace('</sheetData>', $rowXml . '</sheetData>', $xml);
    }

    private static function normalizeCseKey(?string $value): string
    {
        $value = strtoupper(trim((string) $value));
        $value = preg_replace('/[^A-Z0-9]+/', ' ', $value) ?? $value;
        return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
    }

    /**
     * Match a PPMP quantity_size line (name + unit) to one APP-CSE catalog Excel row.
     * Never invents catalog rows — unmatched lines are skipped.
     */
    private static function matchCse2027CatalogLine(array $line, array $index): ?int
    {
        $nameKey = self::normalizeCseKey($line['name'] ?? '');
        if ($nameKey === '') {
            return null;
        }
        $unitKey = CseQtyHelper::normalizeUom($line['unit'] ?? '');

        if (isset($index['by_desc'][$nameKey]) && count($index['by_desc'][$nameKey]) === 1) {
            return $index['by_desc'][$nameKey][0];
        }
        if (isset($index['by_code'][$nameKey]) && count($index['by_code'][$nameKey]) === 1) {
            return $index['by_code'][$nameKey][0];
        }

        $hits = [];
        foreach ($index['items'] as $item) {
            $desc = $item['desc'];
            $code = $item['code'];
            if ($desc === $nameKey || $code === $nameKey) {
                $hits[$item['row']] = $item;
                continue;
            }
            if ($desc !== '' && (str_contains($nameKey, $desc) || str_contains($desc, $nameKey))) {
                $hits[$item['row']] = $item;
                continue;
            }
            // Token overlap: require most significant tokens of the shorter name
            if ($desc !== '' && self::cseNameTokensOverlap($nameKey, $desc)) {
                $hits[$item['row']] = $item;
            }
        }

        if (count($hits) === 1) {
            return (int) array_key_first($hits);
        }

        if (count($hits) > 1 && $unitKey !== '') {
            $uomHits = [];
            foreach ($hits as $rowNum => $item) {
                $catalogUom = CseQtyHelper::normalizeUom($index['uom'][$rowNum] ?? '');
                if ($catalogUom !== '' && $catalogUom === $unitKey) {
                    $uomHits[$rowNum] = true;
                }
            }
            if (count($uomHits) === 1) {
                return (int) array_key_first($uomHits);
            }
        }

        return null;
    }

    private static function cseNameTokensOverlap(string $a, string $b): bool
    {
        $stop = ['AND', 'OR', 'THE', 'OF', 'FOR', 'WITH', 'SIZE', 'ML', 'MM', 'CM', 'PCS'];
        $ta = array_values(array_filter(explode(' ', $a), fn ($t) => strlen($t) > 1 && !in_array($t, $stop, true)));
        $tb = array_values(array_filter(explode(' ', $b), fn ($t) => strlen($t) > 1 && !in_array($t, $stop, true)));
        if (!$ta || !$tb) {
            return false;
        }
        $shorter = count($ta) <= count($tb) ? $ta : $tb;
        $longer = count($ta) <= count($tb) ? $tb : $ta;
        $need = max(2, (int) ceil(count($shorter) * 0.75));
        $hit = 0;
        foreach ($shorter as $tok) {
            if (in_array($tok, $longer, true)) {
                $hit++;
            }
        }
        return $hit >= $need;
    }

    private static function matchCse2027CatalogRow($row, array $index): ?int
    {
        return self::matchCse2027CatalogLine([
            'name' => (string) ($row->description ?? ''),
            'unit' => (string) ($row->unit_of_measure ?? ''),
        ], $index);
    }

    /**
     * Build CSE-APP preview rows from approved PPMP quantity_size lines matched
     * to the stock APP-CSE catalog only (no invented Item & Specs rows).
     * Each row is a catalog SKU with stable catalog_row + code for the web form overlay.
     *
     * @return array<int, object>
     */
    public static function buildCsePreviewRows(int $fiscalYear): array
    {
        $template = self::getCseTemplate();
        if (!file_exists($template)) {
            return [];
        }

        $zip = new ZipArchive();
        if ($zip->open($template) !== true) {
            return [];
        }
        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $stringsXml = $zip->getFromName('xl/sharedStrings.xml');
        $zip->close();
        if ($sheetXml === false || $stringsXml === false) {
            return [];
        }

        $catalogIndex = self::buildCse2027CatalogIndexFromXml($sheetXml, $stringsXml);
        $officesByRow = [];
        $qtyByRow = self::buildCseMonthQtyByCatalogRow($fiscalYear, $catalogIndex, $officesByRow);
        $rows = [];

        foreach ($qtyByRow as $excelRow => $months) {
            $quarters = CseQtyHelper::quartersFromMonthMap($months);
            $total = $quarters['q1'] + $quarters['q2'] + $quarters['q3'] + $quarters['q4'];
            if ($total <= 0) {
                continue;
            }
            $meta = $catalogIndex['meta'][$excelRow] ?? null;
            $unitCost = (float) ($catalogIndex['price'][$excelRow] ?? 0);
            $officeLabels = array_keys($officesByRow[$excelRow] ?? []);
            sort($officeLabels, SORT_NATURAL | SORT_FLAG_CASE);
            $rows[] = (object) [
                'id' => 'cse-catalog-' . $excelRow,
                'catalog_row' => (int) $excelRow,
                'code' => $meta['code'] ?? '',
                'description' => $meta['description'] ?? '',
                'is_cse' => true,
                'unit_of_measure' => $meta['uom'] ?? ($catalogIndex['uom'][$excelRow] ?? null),
                'unit_cost' => $unitCost > 0 ? $unitCost : null,
                'total_quantity' => $total,
                'q1_qty' => $quarters['q1'],
                'q2_qty' => $quarters['q2'],
                'q3_qty' => $quarters['q3'],
                'q4_qty' => $quarters['q4'],
                'total_estimated_budget' => $total * $unitCost,
                'end_user_offices' => $officeLabels ? implode(', ', $officeLabels) : null,
                'quantity_size' => null,
                'proc_start' => null,
                'proc_end' => null,
                'delivery_period' => null,
            ];
        }

        // Keep Excel catalog order (row number) so the web overlay stays aligned.
        usort($rows, fn ($a, $b) => ((int) $a->catalog_row) <=> ((int) $b->catalog_row));
        return $rows;
    }

    /**
     * Quarters from stored app_row values only (no “dump total into Q1” fallback).
     *
     * @return array{q1:int,q2:int,q3:int,q4:int}
     */
    private static function cseQuarterQuantities($row): array
    {
        return [
            'q1' => (int) ($row->q1_qty ?? 0),
            'q2' => (int) ($row->q2_qty ?? 0),
            'q3' => (int) ($row->q3_qty ?? 0),
            'q4' => (int) ($row->q4_qty ?? 0),
        ];
    }

    private static function normalizeProcurementProject(string $description): string
    {
        return strtolower(preg_replace('/\s+/', ' ', trim($description)) ?? '');
    }

    private static function uniqueJoinValues(?string ...$parts): ?string
    {
        $seen = [];
        $out = [];
        foreach ($parts as $part) {
            if ($part === null || $part === '') {
                continue;
            }
            foreach (preg_split('/\s*,\s*/', (string) $part) ?: [] as $token) {
                $token = trim($token);
                if ($token === '') {
                    continue;
                }
                $key = strtolower($token);
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $out[] = $token;
            }
        }
        return $out ? implode(', ', $out) : null;
    }

    /** Official Mode of Procurement labels (longest match preferred). */
    private static function knownProcurementModes(): array
    {
        static $modes = null;
        if ($modes !== null) {
            return $modes;
        }
        $modes = [
            'Competitive Bidding',
            'Limited Source Bidding',
            'Competitive Dialogue',
            'Unsolicited Offer with Bid Matching',
            'Direct Contracting',
            'Direct Acquisition',
            'Repeat Order',
            'Small Value Procurement',
            'Direct Sales',
            'Direct Procurement for Science, Technology and Innovation',
            'Direct Procurement for Science, Technology, and Innovation',
            'Negotiated Procurement',
            'NP - Two Failed Biddings',
            'NP - Emergency Cases',
            'NP - Take-over of Contracts',
            'NP - Adjacent or Contiguous Projects',
            'NP - Agency-to-Agency',
            'NP - Highly Specialized Services',
            'NP - Lease of Real Property and Venue',
            'Negotiated Procurement - Two Failed Bidding',
            'Negotiated Procurement - Emergency Cases',
            'Negotiated Procurement - Take Over of Contracts',
            'Negotiated Procurement - Adjacent or Contiguous',
            'Negotiated Procurement - Agency-to-Agency',
            'Negotiated Procurement - Scientific, Scholarly or Artistic Work, Exclusive Technology',
            'Negotiated Procurement - Highly Technical Consultants',
            'Negotiated Procurement - Defense Cooperation Agreements and Inventory-Based Items',
            'Negotiated Procurement - Lease of Real Property and Venue',
            'Negotiated Procurement - Non-Government Organization (NGO) Participation',
            'Negotiated Procurement - Community Participation',
            'Negotiated Procurement - United Nations (UN) Agencies, International Organizations',
            'Negotiated Procurement - Direct Retail Purchase of Petroleum Fuel, Oil and Lubricants',
        ];
        usort($modes, fn ($a, $b) => strlen($b) <=> strlen($a));
        return $modes;
    }

    /** Collapse "Phrase Phrase Phrase" → "Phrase". */
    private static function collapseRepeatedPhrase(string $token): string
    {
        $text = preg_replace('/\s+/', ' ', trim($token)) ?? '';
        if ($text === '') {
            return '';
        }
        $words = explode(' ', $text);
        $count = count($words);
        for ($len = 1; $len <= intdiv($count, 2); $len++) {
            if ($count % $len !== 0) {
                continue;
            }
            $phrase = implode(' ', array_slice($words, 0, $len));
            $phraseKey = strtolower($phrase);
            $allMatch = true;
            $repeats = intdiv($count, $len);
            for ($i = 1; $i < $repeats; $i++) {
                $chunk = implode(' ', array_slice($words, $i * $len, $len));
                if (strtolower($chunk) !== $phraseKey) {
                    $allMatch = false;
                    break;
                }
            }
            if ($allMatch) {
                return $phrase;
            }
        }
        return $text;
    }

    /**
     * Deduplicate Mode of Procurement values.
     * Same mode once; different modes stay comma-separated.
     * Handles space-repeated copies (not only comma-separated).
     */
    private static function uniqueProcurementModes(?string ...$parts): ?string
    {
        $seen = [];
        $out = [];
        $add = function (string $label) use (&$seen, &$out): void {
            $cleaned = preg_replace('/\s+/', ' ', trim($label)) ?? '';
            if ($cleaned === '') {
                return;
            }
            $key = strtolower($cleaned);
            if (isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            $out[] = $cleaned;
        };

        foreach ($parts as $part) {
            if ($part === null || $part === '') {
                continue;
            }
            $working = preg_replace('/\s+/', ' ', trim((string) $part)) ?? '';
            if ($working === '') {
                continue;
            }

            foreach (self::knownProcurementModes() as $mode) {
                $pattern = '/' . preg_quote($mode, '/') . '/i';
                if (!preg_match($pattern, $working)) {
                    continue;
                }
                $add($mode);
                $working = preg_replace($pattern, ',', $working) ?? '';
                $working = preg_replace('/\s+/', ' ', trim($working)) ?? '';
            }

            foreach (preg_split('/\s*,\s*/', $working) ?: [] as $token) {
                $collapsed = self::collapseRepeatedPhrase($token);
                if ($collapsed !== '') {
                    $add($collapsed);
                }
            }
        }

        return $out ? implode(', ', $out) : null;
    }

    private static function timelineSortKey(string $value): string
    {
        if (preg_match('/^(\d{1,2})[\/\-](\d{4})$/', trim($value), $m)) {
            return sprintf('%04d-%02d', (int) $m[2], (int) $m[1]);
        }
        return strtolower(trim($value));
    }

    private static function earlierTimeline(?string $a, ?string $b): ?string
    {
        if ($a === null || $a === '') {
            return $b;
        }
        if ($b === null || $b === '') {
            return $a;
        }
        return self::timelineSortKey($a) <= self::timelineSortKey($b) ? $a : $b;
    }

    private static function laterTimeline(?string $a, ?string $b): ?string
    {
        if ($a === null || $a === '') {
            return $b;
        }
        if ($b === null || $b === '') {
            return $a;
        }
        return self::timelineSortKey($a) >= self::timelineSortKey($b) ? $a : $b;
    }

    private static function paintNonCseDataRowsOrange(string &$stylesXml): void
    {
        if (!preg_match('/<fills count="(\d+)">/', $stylesXml, $m)) {
            return;
        }
        $count = (int) $m[1];
        $orange = '<fill><patternFill patternType="solid"><fgColor rgb="FFF4B083"/><bgColor rgb="FFF4B083"/></patternFill></fill>';
        $stylesXml = preg_replace(
            '/<fills count="' . $count . '">/',
            '<fills count="' . ($count + 1) . '">',
            $stylesXml,
            1
        );
        $stylesXml = str_replace('</fills>', $orange . '</fills>', $stylesXml);
        $orangeId = $count;
        // Keep Total column styles (xf 25/26) white — template guide: Total ABC is not editable.
        $stylesXml = preg_replace_callback(
            '/(<cellXfs\b[^>]*>)([\s\S]*?)(<\/cellXfs>)/',
            function ($block) use ($orangeId) {
                $i = -1;
                $body = preg_replace_callback('/<xf\b([^>]*?)>/', function ($match) use ($orangeId, &$i) {
                    $i++;
                    $attrs = $match[1];
                    if (in_array($i, [25, 26], true)) {
                        return $match[0];
                    }
                    if (!preg_match('/fontId="8"/', $attrs) || !preg_match('/fillId="2"/', $attrs)) {
                        return $match[0];
                    }
                    $attrs = preg_replace('/fillId="2"/', 'fillId="' . $orangeId . '"', $attrs, 1);
                    return '<xf' . $attrs . '>';
                }, $block[2]);
                return $block[1] . $body . $block[3];
            },
            $stylesXml
        ) ?? $stylesXml;
    }

    private static function expandNonCseTemplateRows(string &$xml, int $copyRow, int $insertBefore, int $extra): void
    {
        if ($extra <= 0) {
            return;
        }
        if (!preg_match('/<row r="' . $copyRow . '"[\s\S]*?<\/row>/', $xml, $m)) {
            return;
        }
        $templateRowXml = $m[0];

        $rowNums = [];
        if (preg_match_all('/<row r="(\d+)"/', $xml, $rowMatches)) {
            $rowNums = array_map('intval', $rowMatches[1]);
        }
        $max = $rowNums ? max($rowNums) : ($insertBefore + 40);
        for ($r = $max; $r >= $insertBefore; $r--) {
            $n = $r + $extra;
            $xml = preg_replace('/(?<![0-9A-Z])([A-Z]{1,3})' . $r . '(?![0-9])/', '${1}' . $n, $xml) ?? $xml;
            $xml = preg_replace('/<row r="' . $r . '"/', '<row r="' . $n . '"', $xml) ?? $xml;
        }

        $dataEnd = $copyRow + $extra;
        $replacements = [
            'A5:E23' => "A5:E{$dataEnd}",
            'J5:J23' => "J5:J{$dataEnd}",
            'L5:N23' => "L5:N{$dataEnd}",
            'F5:I23' => "F5:I{$dataEnd}",
            'D5:D23' => "D5:D{$dataEnd}",
            'N5:N23' => "N5:N{$dataEnd}",
            'A5:A23' => "A5:A{$dataEnd}",
        ];
        $xml = str_replace(array_keys($replacements), array_values($replacements), $xml);

        $clones = '';
        for ($i = 0; $i < $extra; $i++) {
            $newR = $insertBefore + $i;
            $clone = preg_replace('/<row r="' . $copyRow . '"/', '<row r="' . $newR . '"', $templateRowXml) ?? $templateRowXml;
            $clone = preg_replace(
                '/(?<![0-9A-Z])([A-Z]{1,3})' . $copyRow . '(?![0-9])/',
                '${1}' . $newR,
                $clone
            ) ?? $clone;
            $clones .= $clone;
        }
        $shiftedTotal = $insertBefore + $extra;
        $xml = preg_replace(
            '/<row r="' . $shiftedTotal . '"/',
            $clones . '<row r="' . $shiftedTotal . '"',
            $xml,
            1
        ) ?? $xml;

        if (preg_match('/<dimension ref="A1:N(\d+)"/', $xml, $dim)) {
            $xml = str_replace(
                $dim[0],
                '<dimension ref="A1:N' . ((int) $dim[1] + $extra) . '"',
                $xml
            );
        }
    }

    public static function exportNonCseApp(int $fiscalYear): string
    {
        [, $allRows] = self::getAppAndRows($fiscalYear);
        $nonCseRows = self::mergeAppRowsByDescription(
            $allRows->filter(fn($r) => !(bool)$r->is_cse)->values()
        );

        $template = self::getNonCseTemplate();
        if (!file_exists($template)) {
            throw new Exception("Template missing: " . $template);
        }

        $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'noncse_app_' . uniqid('', true) . '.xlsx';
        if (!@copy($template, $tmp)) {
            throw new Exception('Could not copy Non-CSE APP template.');
        }

        $zip = new ZipArchive();
        if ($zip->open($tmp) !== true) {
            @unlink($tmp);
            throw new Exception('Could not open Non-CSE APP template.');
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $stylesXml = $zip->getFromName('xl/styles.xml');
        if ($sheetXml === false) {
            $zip->close();
            @unlink($tmp);
            throw new Exception('Non-CSE APP template is missing worksheet data.');
        }

        $dataStart = 5;
        $templateSlots = 19;
        $itemsCount = count($nonCseRows);
        $extra = max(0, $itemsCount - $templateSlots);

        if ($stylesXml !== false) {
            self::paintNonCseDataRowsOrange($stylesXml);
            $zip->deleteName('xl/styles.xml');
            $zip->addFromString('xl/styles.xml', $stylesXml);
        }

        self::expandNonCseTemplateRows($sheetXml, 23, 24, $extra);

        self::writeSheetTextCell(
            $sheetXml,
            'C1',
            "(Ormoc City Government) Annual Procurement Plan for FY {$fiscalYear}"
        );

        $budgetTotal = 0.0;
        foreach ($nonCseRows as $i => $row) {
            $r = $dataStart + $i;
            self::writeSheetTextCell($sheetXml, "A{$r}", (string) ($row->project_type ?? ''));
            self::writeSheetTextCell($sheetXml, "B{$r}", (string) ($row->description ?? ''));
            self::writeSheetTextCell($sheetXml, "C{$r}", (string) ($row->end_user_offices ?? ''));
            self::writeSheetTextCell($sheetXml, "D{$r}", !empty($row->pre_proc_conf) ? 'Yes' : 'No');
            self::writeSheetTextCell($sheetXml, "E{$r}", (string) ($row->procurement_mode ?? ''));
            self::writeSheetTextCell($sheetXml, "F{$r}", (string) ($row->proc_start ?? ''));
            self::writeSheetTextCell($sheetXml, "G{$r}", (string) ($row->proc_start ?? ''));
            self::writeSheetTextCell($sheetXml, "H{$r}", (string) ($row->proc_end ?? ''));
            self::writeSheetTextCell($sheetXml, "I{$r}", (string) ($row->delivery_period ?? ''));
            self::writeSheetTextCell($sheetXml, "J{$r}", (string) ($row->fund_source ?? ''));
            $mooe = (float) ($row->total_estimated_budget ?? 0);
            $budgetTotal += $mooe;
            if ($mooe != 0.0) {
                self::writeSheetNumericCell($sheetXml, "L{$r}", $mooe);
            }
            $qty = trim((string) ($row->quantity_size ?? ''));
            if ($qty !== '') {
                self::writeSheetTextCell($sheetXml, "N{$r}", $qty);
            }
            // Guide STEP 6: Total ABC auto-computes MOOE + CO and is not editable.
            self::writeSheetFormulaCell(
                $sheetXml,
                "K{$r}",
                "IF(AND(L{$r}=\"\",M{$r}=\"\"),\"\",SUM(L{$r},M{$r}))",
                $mooe != 0.0 ? $mooe : null
            );
        }

        $footerRow = 24 + $extra;
        if ($budgetTotal != 0.0) {
            $n = self::excelNumberString($budgetTotal);
            foreach (['K', 'L'] as $col) {
                $sheetXml = preg_replace(
                    '/(<c r="' . $col . $footerRow . '"[^>]*>[\s\S]*?<v>)[^<]*/',
                    '${1}' . $n,
                    $sheetXml,
                    1
                ) ?? $sheetXml;
            }
        }

        $sig = self::loadAppSignatory();
        $nameRow = 29 + $extra;
        $desigRow = 30 + $extra;
        if (!empty($sig['prepared_by'])) {
            self::writeSheetTextCell($sheetXml, "B{$nameRow}", $sig['prepared_by']);
        }
        if (!empty($sig['prepared_by_designation'])) {
            self::writeSheetTextCell($sheetXml, "B{$desigRow}", $sig['prepared_by_designation']);
        }
        if (!empty($sig['recommended_by'])) {
            self::writeSheetTextCell($sheetXml, "E{$nameRow}", $sig['recommended_by']);
        }
        if (!empty($sig['recommended_by_designation'])) {
            self::writeSheetTextCell($sheetXml, "E{$desigRow}", $sig['recommended_by_designation']);
        }
        if (!empty($sig['approved_by_name'])) {
            self::writeSheetTextCell($sheetXml, "K{$nameRow}", $sig['approved_by_name']);
        }
        if (!empty($sig['approved_by_designation'])) {
            self::writeSheetTextCell($sheetXml, "K{$desigRow}", $sig['approved_by_designation']);
        }

        $zip->deleteName('xl/worksheets/sheet1.xml');
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
        if ($zip->close() !== true) {
            @unlink($tmp);
            throw new Exception('Could not save Non-CSE APP Excel file.');
        }

        $content = file_get_contents($tmp);
        @unlink($tmp);

        if ($content === false || !self::isExcelBinary($content)) {
            throw new Exception('Failed to build a valid Non-CSE APP Excel file.');
        }

        return $content;
    }
}
