import { useState } from 'react';
import axios from 'axios';
import bgImage from "./assets/download.jpg";
import ShinyEdgeBackground from './ShinyEdgeBackground';

// Define the API URL. It will use the live URL in production, or localhost in development.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLanding, setShowLanding] = useState(true); // Added landing page state
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inputApiKey, setInputApiKey] = useState('');
  const [secureData, setSecureData] = useState(null);
  
  const [remainingQuota, setRemainingQuota] = useState(5); // Default to 5
  const maxQuota = 5; // The limit we set in the backend
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); 
  const [copied, setCopied] = useState(false);
  const [codeTab, setCodeTab] = useState('curl');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (mode === 'signup') {
        // Updated to use API_BASE_URL
        await axios.post(`${API_BASE_URL}/signup?email=${email}&password=${password}`);
        setMode('login'); 
        setError('Signup successful! Please log in.');
      } else {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        // Updated to use API_BASE_URL
        const response = await axios.post(`${API_BASE_URL}/login`, formData);
        setToken(response.data.access_token);
        setIsLoggedIn(true);
        // Reset state for new login
        setRemainingQuota(maxQuota); 
        setSecureData(null);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      // Updated to use API_BASE_URL
      const response = await axios.post(`${API_BASE_URL}/generate-key`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApiKey(response.data.api_key);
      setInputApiKey(response.data.api_key); 
      setRemainingQuota(response.data.rate_limit);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate key');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSecureData = async () => {
    if (!inputApiKey) return setError('Please generate or enter an API key first.');
    setLoading(true);
    setError('');
    try {
      // Updated to use API_BASE_URL
      const response = await axios.get(`${API_BASE_URL}/secure-data?_t=${Date.now()}`, {
        headers: { 
          'x-api-key': inputApiKey,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setSecureData(response.data.data);
      setRemainingQuota(response.data.remaining_quota);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('🛑 RATE LIMIT EXCEEDED: You have used up your requests. Please wait 1 minute.');
        setRemainingQuota(0);
      } else if (err.response?.status === 401) {
        setError('❌ UNAUTHORIZED: Invalid API Key.');
      } else {
        setError('An error occurred while fetching data.');
      }
      setSecureData(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setShowLanding(true); // Return to landing page on logout
    setToken(null);
    setApiKey('');
    setSecureData(null);
    setEmail('');
    setPassword('');
  };

  // Calculate percentage REMAINING for the progress bar (Health Bar style)
  const remainingPercentage = (remainingQuota / maxQuota) * 100;

  if (showLanding && !isLoggedIn) {
    return (
      <div className="absolute inset-0 bg-black/5 min-h-screen relative flex flex-col items-center justify-center p-4 font-sans text-gray-800 overflow-hidden">
        <ShinyEdgeBackground imageSrc={bgImage} />
        
        {/* Top Navigation for Landing */}
        <nav className="absolute top-0 w-full p-6 flex justify-between items-center z-20 max-w-6xl mx-auto">
          <div className="text-2xl font-bold text-white shadow-sm" style={{ fontFamily: "Black Ops One" }}>
            FluxGate
          </div>
          <button 
            onClick={() => setShowLanding(false)}
            className="px-6 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors font-semibold backdrop-blur-md"
          >
            Sign In
          </button>
        </nav>

        {/* Hero Section */}
        <div className="relative z-10 max-w-4xl w-full text-center space-y-8 flex flex-col items-center mt-[-10vh]">
          <h1 className="text-white text-7xl md:text-9xl font-bold drop-shadow-2xl tracking-wider" style={{ fontFamily: "Black Ops One" }}>
            FluxGate
          </h1>
          <p className="text-white/90 text-xl md:text-2xl font-medium max-w-2xl mx-auto drop-shadow-md">
            The Enterprise API Gateway. Secure your endpoints, manage developer access, and prevent abuse with real-time rate limiting.
          </p>
          <button
            onClick={() => setShowLanding(false)}
            className="mt-8 px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-110 transition-all duration-300 hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] text-white rounded-full font-bold text-xl border border-white/20"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="absolute inset-0 bg-black/5 min-h-screen relative flex items-center justify-center p-4 font-sans text-gray-800">
        <ShinyEdgeBackground imageSrc={bgImage} />
        <div className="hover:scale-[1.02]
transition-all
duration-500  border border-white shadow-[0_0_40px_rgba(255,255,255,0.18)] relative z-10 max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20
 rounded-3xl shadow-2xl overflow-hidden p-8">
          <div className="text-center mb-8">
            <div className=" flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner"><p
  className="text-white mt-2 text-4xl font-bold"
  style={{ fontFamily: "Black Ops One" }}
>
  FluxGate
</p></div>
            <h1 className="text-4xl font-bold font-['Inter'] text-white">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="transition-all
duration-300 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors" />
            </div>
            {error && <p className={`text-sm text-center font-medium p-2 rounded ${error.includes('successful') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>{error}</p>}
            <button disabled={loading} className="bg-gradient-to-r
from-cyan-500
to-blue-600 hover:scale-105
transition-all
duration-300 hover:shadow-lg
hover:shadow-cyan-500/50 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 active:transform active:scale-[0.98] transition-all shadow-md">
              {loading ? 'Processing...' : (mode === 'login' ? 'Log In to Dashboard' : 'Sign Up')}
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-blue-600 font-bold hover:text-blue-800 transition-colors">
              {mode === 'login' ? 'Sign up for free' : 'Log in here'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">🚀</div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">API Gateway</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-500 hidden sm:block">{email}</span>
          <button onClick={logout} className="text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors px-3 py-1.5 rounded-md hover:bg-red-50 border border-transparent hover:border-red-100">Log Out</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        
        {/* Left Column: Stats & Key Generation */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Account Stats Card with Live Progress Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Live API Usage</h2>
            
            <div className="mb-2 flex justify-between items-end">
              <span className="text-2xl font-bold text-gray-900">{remainingQuota} <span className="text-sm text-gray-500 font-medium">/ {maxQuota} reqs left</span></span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${remainingQuota === 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                {remainingQuota === 0 ? 'Rate Limited' : 'Healthy'}
              </span>
            </div>

            {/* Progress Bar (Thicker with a border) */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden border border-gray-300 shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-500 ease-out ${remainingQuota === 0 ? 'bg-red-500' : 'bg-blue-500'}`} 
                style={{ width: `${remainingPercentage}%` }}
              ></div>
            </div>

            <p className="text-xs text-gray-500">
              Tokens refill automatically via Redis Token Bucket algorithm.
            </p>
          </div>

          {/* Key Generation Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
             <h2 className="text-lg font-bold text-gray-900 mb-2">API Keys</h2>
             <p className="text-sm text-gray-500 mb-6">Generate a new secret key to authenticate your requests.</p>
             <button onClick={handleGenerateKey} disabled={loading} className="w-full bg-gray-900 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all shadow-sm flex justify-center items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              {loading ? 'Generating...' : 'Create Secret Key'}
            </button>

            {apiKey && (
              <div className="mt-6 animate-fade-in-up">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Your Secret Key</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1">
                  <input type="text" readOnly value={apiKey} className="w-full bg-transparent text-sm text-gray-700 font-mono px-3 focus:outline-none" />
                  <button onClick={copyToClipboard} className={`p-2 rounded-md font-medium text-xs transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 shadow-sm'}`}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-amber-600 mt-2 font-medium">⚠️ Store this securely. You won't be able to see it again.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Testing & Developer Docs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Interactive Tester */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Test API Endpoint</h2>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input type="text" value={inputApiKey} onChange={(e) => setInputApiKey(e.target.value)} placeholder="Paste your API Key here (x-api-key)" className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
              <button onClick={handleFetchSecureData} disabled={loading} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm whitespace-nowrap">
                Send Request
              </button>
            </div>

            {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-md">{error}</div>}
            
            {secureData && !error && (
              <div className="bg-gray-900 rounded-lg p-4 shadow-inner overflow-hidden border border-gray-800">
                <div className="flex items-center gap-2 mb-3 border-b border-gray-700 pb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-xs font-bold text-gray-400 font-mono">200 OK</span>
                </div>
                <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap break-words">{JSON.stringify(secureData, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Integration Guide */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex gap-4">
              <button onClick={() => setCodeTab('curl')} className={`text-sm font-semibold transition-colors ${codeTab === 'curl' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>cURL</button>
              <button onClick={() => setCodeTab('python')} className={`text-sm font-semibold transition-colors ${codeTab === 'python' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>Python</button>
              <button onClick={() => setCodeTab('node')} className={`text-sm font-semibold transition-colors ${codeTab === 'node' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>Node.js</button>
            </div>
            <div className="p-6 bg-gray-900 text-gray-300 font-mono text-sm overflow-x-auto">
              {codeTab === 'curl' && (
                <pre><code>curl -X GET {API_BASE_URL}/secure-data \
  -H "x-api-key: {apiKey || 'YOUR_API_KEY'}" \
  -H "Cache-Control: no-cache"</code></pre>
              )}
              {codeTab === 'python' && (
                <pre><code>import requests

url = "{API_BASE_URL}/secure-data"
headers = {"{"}
    "x-api-key": "{apiKey || 'YOUR_API_KEY'}",
    "Cache-Control": "no-cache"
{"}"}

response = requests.get(url, headers=headers)
print(response.json())</code></pre>
              )}
              {codeTab === 'node' && (
                <pre><code>fetch('{API_BASE_URL}/secure-data', {"{"}
  cache: 'no-store',
  headers: {"{"}
    'x-api-key': '{apiKey || 'YOUR_API_KEY'}'
  {"}"}
{"}"})
  .then(response =&gt; response.json())
  .then(data =&gt; console.log(data));</code></pre>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}