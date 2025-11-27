'use client';

import React, { useState } from 'react';

type ApprovalCardProps = {
  toolName: string;
  args: any;
  onApprove: () => void;
  onReject: () => void;
};

const ApprovalCard: React.FC<ApprovalCardProps> = ({ toolName, args, onApprove, onReject }) => {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const handleApprove = () => {
    setStatus('approved');
    onApprove();
  };

  const handleReject = () => {
    setStatus('rejected');
    onReject();
  };

  if (status === 'approved') {
    return (
      <div className="bg-green-100 border border-green-300 p-4 rounded-lg my-2 text-green-800">
        <p className="font-semibold">Action Approved</p>
        <p className="text-sm">Function: {toolName}</p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-red-100 border border-red-300 p-4 rounded-lg my-2 text-red-800">
        <p className="font-semibold">Action Rejected</p>
        <p className="text-sm">Function: {toolName}</p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-lg my-2 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-yellow-800 font-bold flex items-center">
          <span className="mr-2">🛡️</span> Approval Required
        </h3>
        <span className="text-xs text-yellow-600 font-mono bg-yellow-100 px-2 py-1 rounded">
          {toolName}
        </span>
      </div>

      <div className="bg-white p-2 rounded border border-yellow-200 text-xs overflow-auto max-h-32 mb-4">
        <pre className="text-gray-600 font-mono">
          {JSON.stringify(args, null, 2)}
        </pre>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={handleReject}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={handleApprove}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
        >
          Approve Execution
        </button>
      </div>
    </div>
  );
};

export default ApprovalCard;
