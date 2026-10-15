"use client";

import { App } from "./App.tsx";
import { httpBackend } from "@/lib/httpBackend.ts";

export function LocalApp() {
  return <App backend={httpBackend} />;
}
