<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Contract;

class ContractController extends Controller
{
    public function upload(Request $request)
    {
        $request->validate([
            'user_id' => 'required',
            'contract' => 'required|file|mimes:pdf,doc,docx'
        ]);

        $path = $request->file('contract')->store('contracts');

        $contract = Contract::create([
            'user_id' => $request->user_id,
            'file_path' => $path,
            'status' => 'pending'
        ]);

        return response()->json([
            'message' => 'Upload hợp đồng thành công',
            'data' => $contract
        ]);
    }
}
