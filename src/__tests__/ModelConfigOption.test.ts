import {describe, expect, it} from "vitest";
import {
    createModelConfigOption,
    createReasoningEffortConfigOption,
    extraModelIdsFromMeta,
    formatModelDisplayName,
    withClientModels,
} from "../ModelConfigOption";
import {createTestModel} from "./acp-test-utils";

describe("formatModelDisplayName", () => {
    it.each([
        ["gpt-6-astra", "6 Astra"],
        ["GPT-5.6-Sol", "5.6 Sol"],
        ["gpt-5.6-terra", "5.6 Terra"],
        ["gpt-5.6-luna", "5.6 Luna"],
        ["gpt-5.5", "5.5"],
        ["gpt-5.3-codex-spark", "5.3 Codex Spark"],
        ["gpt-5.3/codex-spark", "5.3 Codex Spark"],
        ["gpt-oss-120B", "Oss 120B"],
    ])("formats %s as %s", (displayName, expected) => {
        expect(formatModelDisplayName(displayName)).toBe(expected);
    });

    it.each(["Claude Opus", "custom-provider/model-v2", "o3-mini"])(
        "preserves non-GPT model name %s",
        (displayName) => {
            expect(formatModelDisplayName(displayName)).toBe(displayName);
        },
    );
});

describe("createModelConfigOption", () => {
    it("uses compact GPT labels without changing model ids", () => {
        const option = createModelConfigOption([
            createTestModel({id: "gpt-6-astra", displayName: "GPT-6-Astra"}),
            createTestModel({id: "gpt-5.6-sol", displayName: "GPT-5.6-Sol"}),
            createTestModel({id: "gpt-5.3-codex-spark", displayName: "GPT-5.3-Codex-Spark"}),
        ], "gpt-5.6-sol");

        expect(option).toMatchObject({
            currentValue: "gpt-5.6-sol",
            options: [
                {value: "gpt-6-astra", name: "6 Astra"},
                {value: "gpt-5.6-sol", name: "5.6 Sol"},
                {value: "gpt-5.3-codex-spark", name: "5.3 Codex Spark"},
            ],
        });
    });
});

describe("createReasoningEffortConfigOption", () => {
    it("preserves the model's effort ordering, including advanced and provider-defined levels", () => {
        const levels = ["none", "minimal", "low", "medium", "custom-between", "high", "xhigh", "max", "ultra", "persistent"];
        const efforts = levels.map(reasoningEffort => ({reasoningEffort, description: reasoningEffort}));
        const option = createReasoningEffortConfigOption(efforts, "high");
        expect(option).toMatchObject({currentValue: "high", options: levels.map(value => ({value}))});
        expect(efforts.map(option => option.reasoningEffort)).toEqual(levels);
    });
});

describe("client-supplied models", () => {
    it("trims, dedupes and caps _meta.extraModels", () => {
        expect(extraModelIdsFromMeta(undefined)).toEqual([]);
        expect(extraModelIdsFromMeta({extraModels: "not-an-array"})).toEqual([]);
        expect(extraModelIdsFromMeta({extraModels: [" a ", "a", "", 3, "b"]})).toEqual(["a", "b"]);
        expect(extraModelIdsFromMeta({extraModels: ["claude-opus-5[1m]", "ok-model"]})).toEqual(["ok-model"]);
        const many = Array.from({length: 80}, (_, i) => `m${i}`);
        expect(extraModelIdsFromMeta({extraModels: many})).toHaveLength(64);
    });

    it("appends missing client models with Codex-shaped metadata", () => {
        const models = [createTestModel({id: "gpt-6-terra", displayName: "GPT-6-Terra"})];
        const result = withClientModels(
            models,
            ["my-gateway/model-v2", "gpt-6-terra"],
            [{reasoningEffort: "high", description: "High"}],
            "high",
        );
        expect(result).toHaveLength(2);
        expect(result[1]).toMatchObject({
            id: "my-gateway/model-v2",
            model: "my-gateway/model-v2",
            displayName: "my-gateway/model-v2",
            description: "",
            supportedReasoningEfforts: [{reasoningEffort: "high", description: "High"}],
            defaultReasoningEffort: "high",
            inputModalities: ["text", "image"],
        });
        const option = createModelConfigOption(result, "gpt-6-terra") as {
            options: Array<{value: string}>;
        };
        expect(option.options.map(option => option.value))
            .toEqual(["gpt-6-terra", "my-gateway/model-v2"]);
    });
});
