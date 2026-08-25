<?php

namespace App\Services;

/**
 * Map PPMP PROJECTED TIMELINE (Month Year) + quantity into APP-CSE month/quarter buckets.
 * Does not modify the official APP-CSE Excel template; callers write unlocked month cells only.
 */
class CseQtyHelper
{
    private const MONTH_NAMES = [
        1 => ['january', 'jan'],
        2 => ['february', 'feb'],
        3 => ['march', 'mar'],
        4 => ['april', 'apr'],
        5 => ['may'],
        6 => ['june', 'jun'],
        7 => ['july', 'jul'],
        8 => ['august', 'aug'],
        9 => ['september', 'sep', 'sept'],
        10 => ['october', 'oct'],
        11 => ['november', 'nov'],
        12 => ['december', 'dec'],
    ];

    /** Excel column letters for Jan–Dec on APP-CSE 2027 (unlocked monthly qty cells). */
    public const MONTH_COLUMNS = [
        1 => 'E',
        2 => 'F',
        3 => 'G',
        4 => 'J',
        5 => 'K',
        6 => 'L',
        7 => 'O',
        8 => 'P',
        9 => 'Q',
        10 => 'T',
        11 => 'U',
        12 => 'V',
    ];

    /**
     * Parse a Month Year / MM/YYYY / Excel-ish date into month number 1–12.
     */
    public static function parseTimelineMonth(?string $value): ?int
    {
        if ($value === null) {
            return null;
        }
        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        // Numeric month/year: 03/2027, 3-2027, 2027-03, 2027/3
        if (preg_match('/^(\d{1,2})[\/\-](\d{4})$/', $text, $m)) {
            $month = (int) $m[1];
            return ($month >= 1 && $month <= 12) ? $month : null;
        }
        if (preg_match('/^(\d{4})[\/\-](\d{1,2})$/', $text, $m)) {
            $month = (int) $m[2];
            return ($month >= 1 && $month <= 12) ? $month : null;
        }

        // Excel serial date (rarely stored as plain number string)
        if (preg_match('/^\d+(\.\d+)?$/', $text)) {
            $serial = (float) $text;
            if ($serial > 20000 && $serial < 60000) {
                // Excel epoch 1899-12-30
                $unix = (int) (($serial - 25569) * 86400);
                $month = (int) gmdate('n', $unix);
                return ($month >= 1 && $month <= 12) ? $month : null;
            }
        }

        $lower = strtolower($text);
        $lower = preg_replace('/[^a-z0-9]+/', ' ', $lower) ?? $lower;
        $lower = trim(preg_replace('/\s+/', ' ', $lower) ?? $lower);

        foreach (self::MONTH_NAMES as $num => $names) {
            foreach ($names as $name) {
                if (preg_match('/\b' . preg_quote($name, '/') . '\b/', $lower)) {
                    return $num;
                }
            }
        }

        return null;
    }

    public static function monthToQuarter(int $month): int
    {
        if ($month < 1 || $month > 12) {
            return 0;
        }
        return (int) ceil($month / 3);
    }

    /**
     * Quantity from PPMP item: prefer quantity column, else sum of quantity_size lines,
     * else leading integer in quantity_size.
     */
    public static function parsePpmpQuantity($item): int
    {
        if (is_array($item)) {
            $qty = $item['quantity'] ?? null;
            $quantitySize = $item['quantity_size'] ?? null;
        } else {
            $qty = $item->quantity ?? null;
            $quantitySize = $item->quantity_size ?? null;
        }

        if ($qty !== null && $qty !== '' && is_numeric($qty) && (int) $qty > 0) {
            return (int) $qty;
        }

        $lines = self::parseQuantitySizeLines($quantitySize);
        if ($lines) {
            $sum = 0;
            foreach ($lines as $line) {
                $sum += (int) ($line['qty'] ?? 0);
            }
            return $sum;
        }

        $text = trim((string) ($quantitySize ?? ''));
        if ($text === '') {
            return 0;
        }
        if (preg_match('/^\s*(\d+)\b/', $text, $m)) {
            return (int) $m[1];
        }

        return 0;
    }

    /**
     * Split PPMP "Items (Quantity, Unit, Name)" cells into lines.
     * Examples: "366 bottle-Alcohol, Ethyl, 500 mL", "15 gal-Alcohol, Ethyl 70%"
     *
     * @return array<int, array{qty:int, unit:string, name:string}>
     */
    public static function parseQuantitySizeLines(?string $quantitySize): array
    {
        $text = trim((string) ($quantitySize ?? ''));
        if ($text === '') {
            return [];
        }

        // Offices put one item per line in quantity_size; keep names intact
        // (names often contain digits like 500ml, 80 gsm, #35, 2 ply).
        $chunks = preg_split('/[\r\n]+/', $text) ?: [];
        $out = [];
        foreach ($chunks as $chunk) {
            $line = trim($chunk);
            if ($line === '') {
                continue;
            }
            if (!preg_match('/^\s*(\d+)\s*([A-Za-z.%]+)?\s*[-–]?\s*(.+?)\s*$/u', $line, $m)) {
                continue;
            }
            $qty = (int) $m[1];
            $unit = trim((string) ($m[2] ?? ''));
            $name = trim((string) ($m[3] ?? ''));
            $name = preg_replace('/\s+/', ' ', $name) ?? $name;
            $name = rtrim($name, " \t.,;");
            if ($qty <= 0 || $name === '') {
                continue;
            }
            $out[] = [
                'qty' => $qty,
                'unit' => $unit,
                'name' => $name,
            ];
        }

        return $out;
    }

    /**
     * Expand one CSE PPMP item into catalog-matchable lines with timeline month.
     *
     * @return array<int, array{qty:int, unit:string, name:string, month:?int}>
     */
    public static function expandCsePpmpItemLines($item): array
    {
        $month = self::timelineMonthFromItem($item);
        if (is_array($item)) {
            $quantitySize = $item['quantity_size'] ?? null;
            $description = trim((string) ($item['description'] ?? ''));
            $qty = $item['quantity'] ?? null;
            $unit = trim((string) ($item['unit_of_measure'] ?? ''));
        } else {
            $quantitySize = $item->quantity_size ?? null;
            $description = trim((string) ($item->description ?? ''));
            $qty = $item->quantity ?? null;
            $unit = trim((string) ($item->unit_of_measure ?? ''));
        }

        $lines = self::parseQuantitySizeLines($quantitySize);
        if ($lines) {
            $out = [];
            foreach ($lines as $line) {
                $out[] = [
                    'qty' => $line['qty'],
                    'unit' => $line['unit'],
                    'name' => $line['name'],
                    'month' => $month,
                ];
            }
            return $out;
        }

        // Single catalog-style description + quantity column
        if ($description !== '' && $qty !== null && $qty !== '' && (int) $qty > 0) {
            return [[
                'qty' => (int) $qty,
                'unit' => $unit,
                'name' => $description,
                'month' => $month,
            ]];
        }

        return [];
    }

    public static function normalizeUom(?string $unit): string
    {
        $u = strtolower(trim((string) ($unit ?? '')));
        $u = rtrim($u, '.');
        $map = [
            'bot' => 'bottle',
            'btl' => 'bottle',
            'bottle' => 'bottle',
            'gal' => 'gallon',
            'gallon' => 'gallon',
            'pc' => 'piece',
            'pcs' => 'piece',
            'piece' => 'piece',
            'pck' => 'pack',
            'pk' => 'pack',
            'pack' => 'pack',
            'ream' => 'ream',
            'box' => 'box',
            'can' => 'can',
            'roll' => 'roll',
            'pouch' => 'pouch',
            'unit' => 'unit',
            'ctrg' => 'cartridge',
            'crtg' => 'cartridge',
            'cartridge' => 'cartridge',
            'set' => 'set',
            'pad' => 'pad',
            'book' => 'book',
            'jar' => 'jar',
            'tube' => 'tube',
            'pair' => 'pair',
        ];
        return $map[$u] ?? $u;
    }

    /**
     * Timeline month from PROJECTED TIMELINE fields (start → delivery → end).
     */
    public static function timelineMonthFromItem($item): ?int
    {
        if (is_array($item)) {
            $candidates = [
                $item['proc_start'] ?? null,
                $item['delivery_period'] ?? null,
                $item['proc_end'] ?? null,
            ];
        } else {
            $candidates = [
                $item->proc_start ?? null,
                $item->delivery_period ?? null,
                $item->proc_end ?? null,
            ];
        }

        foreach ($candidates as $value) {
            // delivery_period may be comma-joined after merge; use first parseable token
            foreach (preg_split('/\s*,\s*/', (string) ($value ?? '')) ?: [] as $token) {
                $month = self::parseTimelineMonth($token);
                if ($month !== null) {
                    return $month;
                }
            }
        }

        return null;
    }

    /**
     * @return array{q1:int,q2:int,q3:int,q4:int,total:int,month:?int}
     */
    public static function quarterBucketFromItem($item): array
    {
        $qty = self::parsePpmpQuantity($item);
        $month = self::timelineMonthFromItem($item);
        $out = ['q1' => 0, 'q2' => 0, 'q3' => 0, 'q4' => 0, 'total' => $qty, 'month' => $month];

        if ($qty <= 0 || $month === null) {
            return $out;
        }

        $q = self::monthToQuarter($month);
        if ($q >= 1 && $q <= 4) {
            $out['q' . $q] = $qty;
        }

        return $out;
    }

    /**
     * Empty Jan–Dec month qty map (keys 1–12).
     *
     * @return array<int, int>
     */
    public static function emptyMonthMap(): array
    {
        return array_fill(1, 12, 0);
    }

    /**
     * Add one PPMP item's qty into a month map.
     * Expands quantity_size lines when present (caller should match lines to catalog separately).
     * Prefer addExpandedLineToMonthMap for catalog fills.
     *
     * @param  array<int, int>  $months
     */
    public static function addItemToMonthMap(array &$months, $item): int
    {
        $lines = self::expandCsePpmpItemLines($item);
        if (!$lines) {
            $bucket = self::quarterBucketFromItem($item);
            $month = $bucket['month'];
            $qty = $bucket['total'];
            if ($month === null || $qty <= 0) {
                return 0;
            }
            if (!isset($months[$month])) {
                $months[$month] = 0;
            }
            $months[$month] += $qty;
            return $qty;
        }

        $added = 0;
        foreach ($lines as $line) {
            $month = $line['month'] ?? null;
            $qty = (int) ($line['qty'] ?? 0);
            if ($month === null || $qty <= 0) {
                continue;
            }
            if (!isset($months[$month])) {
                $months[$month] = 0;
            }
            $months[$month] += $qty;
            $added += $qty;
        }
        return $added;
    }

    /**
     * @param  array<int, int>  $months
     */
    public static function addExpandedLineToMonthMap(array &$months, array $line): int
    {
        $month = $line['month'] ?? null;
        $qty = (int) ($line['qty'] ?? 0);
        if ($month === null || $qty <= 0) {
            return 0;
        }
        if (!isset($months[$month])) {
            $months[$month] = 0;
        }
        $months[$month] += $qty;
        return $qty;
    }

    /**
     * @param  array<int, int>  $months
     * @return array{q1:int,q2:int,q3:int,q4:int}
     */
    public static function quartersFromMonthMap(array $months): array
    {
        $q = ['q1' => 0, 'q2' => 0, 'q3' => 0, 'q4' => 0];
        foreach ($months as $month => $qty) {
            $qi = self::monthToQuarter((int) $month);
            if ($qi >= 1 && $qi <= 4) {
                $q['q' . $qi] += (int) $qty;
            }
        }
        return $q;
    }
}
