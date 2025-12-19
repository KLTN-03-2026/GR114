<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Law;

class LawController extends Controller
{
    public function upload(Request $request)
    {
        $request->validate([
            'title' => 'required',
            'law_file' => 'required|file|mimes:pdf,json'
        ]);

        $file = $request->file('law_file');
        $path = $file->store('laws');

        $law = Law::create([
            'title' => $request->title,
            'file_path' => $path,
            'type' => $file->extension()
        ]);

        return response()->json([
            'message' => 'Upload luật thành công',
            'data' => $law
        ]);
    }
}
