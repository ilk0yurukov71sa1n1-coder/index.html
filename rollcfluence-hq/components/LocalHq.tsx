"use client";

import { HqApp } from "./HqApp.tsx";
import { httpBackend } from "@/core/httpBackend.ts";

export function LocalHq() {
  return <HqApp backend={httpBackend} />;
}
