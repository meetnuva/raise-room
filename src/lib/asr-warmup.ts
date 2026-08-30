const warmupSamples = new Float32Array(1600);

export async function warmUpAsrModel<TInputs extends object>({
  processor,
  model,
}: {
  processor(audio: Float32Array): Promise<TInputs>;
  model: { generate(inputs: TInputs & { max_new_tokens: number }): Promise<unknown> };
}): Promise<void> {
  const inputs = await processor(warmupSamples);
  await model.generate({ ...inputs, max_new_tokens: 1 });
}
