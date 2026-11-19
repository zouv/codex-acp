import type {SessionConfigOption} from "@agentclientprotocol/sdk/unstable";
import type {ReasoningEffort} from "./app-server";
import type {Model, ReasoningEffortOption} from "./app-server/v2";
import {AIR_RECOMMENDED_CONFIG_VALUE_KEY, withAirMeta} from "./AirExtension";

export const MODEL_CONFIG_ID = "model";
export const REASONING_EFFORT_CONFIG_ID = "reasoning_effort";

/**
 * Turn Codex's GPT display ids into compact picker labels without coupling the
 * adapter to a particular model catalog. Custom/provider model names remain
 * untouched because their punctuation may be meaningful.
 */
export function formatModelDisplayName(displayName: string): string {
    if (!/^gpt-/i.test(displayName)) return displayName;
    return displayName
        .replace(/^gpt-/i, "")
        .split(/[-/]+/)
        .filter(Boolean)
        .map(capitalize)
        .join(" ");
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function findSupportedEffort(
    options: ReadonlyArray<ReasoningEffortOption>,
    effort: string | undefined,
): ReasoningEffort | undefined {
    if (!effort) return undefined;
    return options.find(o => o.reasoningEffort === effort)?.reasoningEffort;
}

const MAX_EXTRA_MODELS = 64;

/**
 * Custom model ids from a client's `_meta.extraModels` (trimmed, deduped,
 * capped). The client injects them so the model picker can offer ids Codex's
 * own catalog does not name, for example a gateway model.
 */
export function extraModelIdsFromMeta(meta: unknown): string[] {
    const raw = (meta as {extraModels?: unknown} | null | undefined)?.extraModels;
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        if (typeof item !== "string") continue;
        const id = item.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= MAX_EXTRA_MODELS) break;
    }
    return out;
}

/**
 * Appends client-supplied models to the session's catalog. A synthesized entry
 * carries the id as its model and a formatted display name; the client maps it
 * to the friendly name it configured. Codex has no metadata for these ids, so
 * the entry borrows the current model's effort list rather than inventing one.
 */
export function withClientModels(
    availableModels: ReadonlyArray<Model>,
    extraIds: ReadonlyArray<string>,
    fallbackEfforts: ReadonlyArray<ReasoningEffortOption>,
    fallbackEffort: ReasoningEffort,
): Model[] {
    if (extraIds.length === 0) return [...availableModels];
    const out = [...availableModels];
    for (const id of extraIds) {
        if (out.some(model => model.id === id)) continue;
        out.push({
            id,
            model: id,
            upgrade: null,
            upgradeInfo: null,
            availabilityNux: null,
            displayName: formatModelDisplayName(id),
            description: "",
            modelSpecialty: null,
            hidden: false,
            supportedReasoningEfforts: fallbackEfforts.map(option => ({...option})),
            defaultReasoningEffort: fallbackEffort,
            inputModalities: ["text", "image"],
            supportsPersonality: false,
            multiAgentVersion: null,
            additionalSpeedTiers: [],
            serviceTiers: [],
            defaultServiceTier: null,
            availableAccessPrograms: null,
            isDefault: false,
        });
    }
    return out;
}

type ModelOption = { value: string; name: string; description: string | null };

/** The entries of the session `model` option. */
function modelOptions(availableModels: ReadonlyArray<Model>, currentBaseModelId: string | null): Array<ModelOption> {
    const options: Array<ModelOption> = availableModels.map(model => ({
        value: model.id,
        name: formatModelDisplayName(model.displayName),
        description: model.description,
    }));
    if (currentBaseModelId !== null && !availableModels.some(model => model.id === currentBaseModelId)) {
        options.unshift({
            value: currentBaseModelId,
            name: formatModelDisplayName(currentBaseModelId),
            description: null,
        });
    }
    return options;
}

export function createModelConfigOption(
    availableModels: Array<Model>,
    currentBaseModelId: string,
    recommendedModelId?: string,
): SessionConfigOption {
    const options = modelOptions(availableModels, currentBaseModelId);

    const recommendation = recommendedModelId && options.some(option => option.value === recommendedModelId)
        ? recommendedModelId
        : undefined;
    return {
        id: MODEL_CONFIG_ID,
        name: "Model",
        description: "Model Codex uses for the session",
        category: "model",
        type: "select",
        currentValue: currentBaseModelId,
        options,
        ...(recommendation
            ? {_meta: withAirMeta(undefined, AIR_RECOMMENDED_CONFIG_VALUE_KEY, recommendation)}
            : {}),
    };
}

export function createReasoningEffortConfigOption(
    supportedReasoningEfforts: Array<ReasoningEffortOption>,
    currentEffort: string,
    recommendedEffort?: string,
): SessionConfigOption {
    const recommendation = findSupportedEffort(supportedReasoningEfforts, recommendedEffort);
    return {
        id: REASONING_EFFORT_CONFIG_ID,
        name: "Reasoning effort",
        description: "How much reasoning effort the model should use",
        category: "thought_level",
        type: "select",
        currentValue: currentEffort,
        // Codex supplies the model's effort ordering, including provider-defined levels.
        options: supportedReasoningEfforts.map(option => ({
            value: option.reasoningEffort,
            name: capitalize(option.reasoningEffort),
            description: option.description,
        })),
        ...(recommendation
            ? {_meta: withAirMeta(undefined, AIR_RECOMMENDED_CONFIG_VALUE_KEY, recommendation)}
            : {}),
    };
}

/**
 * The model option of a native subagent session. The client may not change the model of a subagent, so the
 * option offers only the current model. Its value and name are those of the same model in the `model` option
 * of the parent session, so that the client can compare them. A model that the parent option does not offer
 * keeps its full id as the value and the name.
 */
export function createSubagentModelConfigOption(
    availableModels: ReadonlyArray<Model>,
    parentBaseModelId: string | null,
    model: string,
): SessionConfigOption {
    // Without models the parent session has no model option, so there is nothing to match.
    const parentOptions = availableModels.length > 0 ? modelOptions(availableModels, parentBaseModelId) : [];
    // Codex can name a model by its `model` slug instead of its id.
    const id = availableModels.find(candidate => candidate.id === model)?.id
        ?? availableModels.find(candidate => candidate.model === model)?.id
        ?? model;
    const option = parentOptions.find(candidate => candidate.value === id)
        ?? {value: model, name: model, description: null};
    return {
        id: MODEL_CONFIG_ID,
        name: "Model",
        description: "Model Codex uses for the subagent",
        category: "model",
        type: "select",
        currentValue: option.value,
        options: [option],
    };
}
