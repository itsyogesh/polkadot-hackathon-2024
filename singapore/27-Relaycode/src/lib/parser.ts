import { PolkadotApi } from "@dedot/chaintypes";
import { DedotClient } from "dedot";
import { Metadata } from "dedot/codecs";
import { assert, stringCamelCase } from "dedot/utils";

export function createSectionOptions(
  metadata: Metadata["latest"] | null
): { text: string; value: string }[] | null {
  if (!metadata) return null;
  return metadata?.pallets
    .filter((pallet) => !!pallet.calls)
    .map((pallet) => ({
      value: stringCamelCase(pallet.name),
      text: pallet.name,
    }));
}

export type ClientMethod = {
  section: string;
  method: string;
  args: { name: string; type: number; value?: string }[] | null;
};

export function createMethodOptions(
  client: DedotClient<PolkadotApi>,
  metadata: Metadata["latest"] | null,
  sectionName: string
): ClientMethod[] | null {
  const pallet = metadata?.pallets.find(
    (pallet) => stringCamelCase(pallet.name) === sectionName
  );

  if (!pallet?.calls) return null;

  const palletCalls = client.registry.findType(pallet?.calls);
  assert(palletCalls.typeDef.type === "Enum");

  return palletCalls.typeDef.value.members.map((call) => {
    return {
      section: sectionName,
      method: call.name,
      args: call.fields.map((arg) => ({
        name: arg.name || "",
        type: arg.typeId,
      })),
    };
  });
}
