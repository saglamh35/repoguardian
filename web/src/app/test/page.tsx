'use client';
import { useState } from 'react';

export default function TestPage() {
    const [result, setResult] = useState<string>('');
    const [loading, setLoading] = useState(false);

    async function testPing() {
        setLoading(true);
        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'ping' }),
            });

            if (res.ok) {
                const data = await res.json();
                setResult(`✅ Success: Job ${data.id} (${data.name}) queued`);
            } else {
                const error = await res.text();
                setResult(`❌ Error (${res.status}): ${error}`);
            }
        } catch (error) {
            setResult(`❌ Exception: ${error}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Job Queue Test</h1>

            <div className="space-y-4">
                <button
                    onClick={testPing}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Testing...' : 'Test Ping Job'}
                </button>

                {result && (
                    <div className="mt-4 p-4 border rounded bg-gray-50">
                        <pre className="text-sm">{result}</pre>
                    </div>
                )}

                <div className="mt-6 p-4 border rounded bg-yellow-50">
                    <h3 className="font-medium text-yellow-800 mb-2">Instructions:</h3>
                    <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                        <li>Start Redis: <code className="bg-yellow-100 px-1 rounded">docker compose up -d</code></li>
                        <li>Start Worker: <code className="bg-yellow-100 px-1 rounded">cd worker && pnpm dev</code></li>
                        <li>Click "Test Ping Job" above</li>
                        <li>Check worker console for "pong" message</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}

