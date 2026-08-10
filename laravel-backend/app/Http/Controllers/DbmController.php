<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\DbmClassification;

class DbmController extends Controller
{
    public function listClassifications()
    {
        return response()->json(DbmClassification::all());
    }

    public function createClassification(Request $request)
    {
        $code = trim($request->input('code', ''));
        $title = trim($request->input('project_title', ''));
        $classification = trim($request->input('classification', ''));

        if (!$code || !$title || !$classification) {
            return response()->json(['detail' => 'Code, project title, and classification are required'], 400);
        }

        if (DbmClassification::where('code', $code)->exists()) {
            return response()->json(['detail' => 'DBM classification code already exists'], 400);
        }

        $item = DbmClassification::create([
            'code' => $code,
            'project_title' => $title,
            'classification' => $classification,
        ]);

        return response()->json($item);
    }

    public function getClassification(int $id)
    {
        $item = DbmClassification::find($id);
        if (!$item) {
            return response()->json(['detail' => 'DBM classification not found'], 404);
        }
        return response()->json($item);
    }

    public function deleteClassification(int $id)
    {
        $item = DbmClassification::find($id);
        if (!$item) {
            return response()->json(['detail' => 'DBM classification not found'], 404);
        }
        $item->delete();
        return response()->json(['message' => 'DBM classification deleted successfully']);
    }
}
