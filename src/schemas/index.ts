// Zod input schemas for all tools
import { z } from 'zod';
import { MAX_DEPTH, MAX_MULTI_PV } from '../constants.js';

export const AnalysePositionSchema = z.object({
  fen: z.string()
    .describe('FEN string of the position to analyse'),
  depth: z.number()
    .int()
    .min(1)
    .max(MAX_DEPTH)
    .default(20)
    .describe('Search depth (1–30, default 20)'),
  multiPv: z.number()
    .int()
    .min(1)
    .max(MAX_MULTI_PV)
    .default(3)
    .describe('Number of principal variations to return (1–5, default 3)'),
}).strict();

export const AnalyseGameSchema = z.object({
  pgn: z.string()
    .describe('Full PGN of the game to analyse'),
  depth: z.number()
    .int()
    .min(1)
    .max(MAX_DEPTH)
    .default(22)
    .describe('Search depth per move (1–30, default 22). Lower depth = faster.'),
}).strict();

export const LookupOpeningSchema = z.object({
  query: z.string()
    .min(1)
    .describe('Opening name or ECO code to search for (e.g. "Sicilian", "B20", "Italian")'),
}).strict();

export const IdentifyOpeningSchema = z.object({
  pgn: z.string()
    .describe('PGN or space-separated SAN moves to identify the opening'),
}).strict();

export const GeneratePuzzleSchema = z.object({
  fen: z.string()
    .describe('FEN of the position to generate a puzzle from'),
  depth: z.number()
    .int()
    .min(1)
    .max(MAX_DEPTH)
    .default(22)
    .describe('Search depth for finding tactics (1–30, default 22)'),
}).strict();

export type AnalysePositionInput = z.infer<typeof AnalysePositionSchema>;
export type AnalyseGameInput = z.infer<typeof AnalyseGameSchema>;
export type LookupOpeningInput = z.infer<typeof LookupOpeningSchema>;
export type IdentifyOpeningInput = z.infer<typeof IdentifyOpeningSchema>;
export type GeneratePuzzleInput = z.infer<typeof GeneratePuzzleSchema>;
