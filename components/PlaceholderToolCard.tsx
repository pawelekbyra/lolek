import React from 'react';

const PlaceholderToolCard = ({ toolCall }: { toolCall: any }) => {
  return (
    <div className="bg-gray-200 p-4 rounded-lg my-2">
      <p className="font-bold text-gray-800">{toolCall.toolName}</p>
      <pre className="text-sm text-gray-600">
        {JSON.stringify(toolCall.args, null, 2)}
      </pre>
    </div>
  );
};

export default PlaceholderToolCard;
