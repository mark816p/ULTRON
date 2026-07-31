export interface FreeLlmResource {
  id: string;
  name: string;
  provider: string;
  model: string;
  description: string;
  baseUrl: string;
  isFreeTier: boolean;
  requiresKey: boolean;
  signupUrl: string;
  rateLimit: string;
  speed: "Ultra-Fast" | "Fast" | "Standard";
}

export const FREE_LLM_RESOURCES: FreeLlmResource[] = [
  {
    id: "gemini-free-flash",
    name: "Google Gemini 2.0 Flash (Free Tier)",
    provider: "Google AI",
    model: "gemini-2.0-flash",
    description: "Multimodal, 1M token context, sub-second inference speed.",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    isFreeTier: true,
    requiresKey: false,
    signupUrl: "https://aistudio.google.com/",
    rateLimit: "15 RPM / 1M TPM",
    speed: "Ultra-Fast",
  },
  {
    id: "groq-llama-70b",
    name: "Groq Llama-3.3 70B Versatile",
    provider: "Groq",
    model: "llama-3.3-70b-versatile",
    description: "Sub-second response speed powered by LPU inference engine.",
    baseUrl: "https://api.groq.com/openai/v1",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://console.groq.com/keys",
    rateLimit: "30 RPM / 14.4k RPD",
    speed: "Ultra-Fast",
  },
  {
    id: "cerebras-llama-70b",
    name: "Cerebras Llama-3.3 70B",
    provider: "Cerebras",
    model: "llama-3.3-70b",
    description: "2000+ tokens/sec ultra-high-speed wafer-scale engine.",
    baseUrl: "https://api.cerebras.ai/v1",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://cloud.cerebras.ai/",
    rateLimit: "30 RPM / 60k TPM",
    speed: "Ultra-Fast",
  },
  {
    id: "openrouter-free-auto",
    name: "OpenRouter Free Models (Auto Router)",
    provider: "OpenRouter",
    model: "openrouter/auto",
    description: "Routes to best available free model (DeepSeek, Llama 3, Qwen).",
    baseUrl: "https://openrouter.ai/api/v1",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://openrouter.ai/keys",
    rateLimit: "200 RPD",
    speed: "Fast",
  },
  {
    id: "deepseek-free-r1",
    name: "DeepSeek R1 / V3 Free Tier",
    provider: "DeepSeek",
    model: "deepseek-reasoner",
    description: "Advanced chain-of-thought reasoning AI model.",
    baseUrl: "https://api.deepseek.com/v1",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://platform.deepseek.com/",
    rateLimit: "Standard free quota",
    speed: "Standard",
  },
  {
    id: "sambanova-llama-405b",
    name: "SambaNova Llama-3.1 405B",
    provider: "SambaNova",
    model: "Meta-Llama-3.1-405B-Instruct",
    description: "Massive 405B parameter open model on SN40L Reconfigurable Dataflow Unit.",
    baseUrl: "https://api.sambanova.ai/v1",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://cloud.sambanova.ai/",
    rateLimit: "High speed free tier",
    speed: "Ultra-Fast",
  },
  {
    id: "together-free-qwen",
    name: "Together AI Qwen 2.5 72B",
    provider: "Together AI",
    model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
    description: "High accuracy open model for code, reasoning, and multilingual tasks.",
    baseUrl: "https://api.together.xyz/v1",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://api.together.ai/",
    rateLimit: "Free initial credits",
    speed: "Fast",
  },
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI (Llama 3.1)",
    provider: "Cloudflare",
    model: "@cf/meta/llama-3.1-8b-instruct",
    description: "Global edge inference powered by Cloudflare serverless GPUs.",
    baseUrl: "https://api.cloudflare.com/client/v4",
    isFreeTier: true,
    requiresKey: true,
    signupUrl: "https://dash.cloudflare.com/",
    rateLimit: "10,000 neurons / day free",
    speed: "Ultra-Fast",
  },
];

export function getFreeResources(): FreeLlmResource[] {
  return FREE_LLM_RESOURCES;
}
