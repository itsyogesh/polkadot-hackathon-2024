import React, { useState, useEffect } from "react";
import { DedotClient } from "dedot";
import type { PolkadotApi } from "@dedot/chaintypes";
import { Metadata } from "dedot/codecs";
import {
  assert,
  stringToU8a,
  toHex,
  u8aToString,
  xxhashAsU8a,
} from "dedot/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientMethod } from "@/lib/parser";

interface InformationPaneProps {
  extrinsic: ClientMethod | null;
  client: DedotClient<PolkadotApi> | null;
  metadata: Metadata["latest"] | null;
  onExtrinsicChange: (extrinsic: ClientMethod) => void;
}

const InformationPane: React.FC<InformationPaneProps> = ({
  extrinsic,
  client,
  metadata,
  onExtrinsicChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [sectionHex, setSectionHex] = useState<Uint8Array | null>(null);
  const [functionHex, setFunctionHex] = useState<Uint8Array | null>(null);
  const [argsHex, setArgsHex] = useState<Uint8Array[] | null>(null);
  const [encodedCallData, setEncodedCallData] = useState<Uint8Array | null>(
    null
  );
  const [encodedCallHash, setEncodedCallHash] = useState<Uint8Array | null>(
    null
  );

  useEffect(() => {
    if (extrinsic && client && metadata) {
      updateDisplayValues(extrinsic);
    }
  }, [extrinsic, client, metadata]);

  const updateDisplayValues = (extrinsic: ClientMethod) => {
    setSectionHex(xxhashAsU8a(extrinsic.section, 128));
    setFunctionHex(xxhashAsU8a(extrinsic.method, 128));

    const args = extrinsic?.args?.map((arg) => xxhashAsU8a(arg.name, 128));
    if (args) setArgsHex(args);
    setEncodedCallData(xxhashAsU8a(extrinsic.section, 128));
    setEncodedCallHash(xxhashAsU8a(extrinsic.section, 128));
  };

  const handleHexChange =
    (type: "section" | "function" | "args", index: number = 0) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editing || !client || !metadata) return;

      let newValue = e.target.value;
      if (!newValue.startsWith("0x")) {
        newValue = "0x" + newValue;
      }

      switch (type) {
        case "section":
          setSectionHex(stringToU8a(newValue));
          break;
        case "function":
          setFunctionHex(stringToU8a(newValue));
          break;
        case "args":
          if (!argsHex) return;
          const newArgs = [...argsHex];
          newArgs[index] = stringToU8a(newValue);
          setArgsHex(newArgs);
          break;
      }

      try {
        const newCallData = `${sectionHex}${functionHex}${argsHex?.join("")}`;
        const pallet = metadata?.pallets.find(
          (p) => p.name === u8aToString(sectionHex)
        );
        if (!pallet?.calls) return null;
        const palletCalls = client.registry.findType(pallet?.calls);
        assert(palletCalls.typeDef.type === "Enum");

        const method = palletCalls.typeDef.value.members.find(
          (m) => xxhashAsU8a(m.name, 128) === functionHex
        );
        if (!method) return null;
        const args = method.fields.map((arg, index) => {
          return {
            name: arg.name || "",
            type: arg.typeId || 0,
            value: argsHex ? u8aToString(argsHex[index]) : "",
          };
        });
        const newExtrinsic: ClientMethod = {
          section: pallet.name || "",
          method: method.name || "",
          args: args,
        };
        onExtrinsicChange(newExtrinsic);
      } catch (error) {
        console.error("Error updating extrinsic:", error);
      }
    };

  const handleEncodedCallDataChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (!editing || !client) return;

    const newCallData = e.target.value;
    setEncodedCallData(xxhashAsU8a(newCallData, 128));

    // try {
    //   const newExtrinsic = client.createFromCallHex(newCallData);
    //   onExtrinsicChange(newExtrinsic);
    // } catch (error) {
    //   console.error("Error updating extrinsic from encoded call data:", error);
    // }
  };

  const renderColorCodedCallData = () => {
    if (!encodedCallData) return null;

    const prefix = encodedCallData.slice(0, 2);
    const section = encodedCallData.slice(2, 4);
    const func = encodedCallData.slice(4, 6);
    const args = encodedCallData.slice(6);

    return (
      <div className="font-mono break-all">
        <span className="text-gray-500">{prefix}</span>
        <span className="text-red-500">{section}</span>
        <span className="text-green-500">{func}</span>
        <span className="text-blue-500">{args}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Information Pane</h2>
        <div className="flex items-center space-x-2">
          <Switch
            id="editing-mode"
            checked={editing}
            onCheckedChange={setEditing}
          />
          <Label htmlFor="editing-mode">Enable Editing</Label>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Section Hex</Label>
          <Input
            value={toHex(sectionHex || "")}
            onChange={handleHexChange("section")}
            disabled={!editing}
            className="font-mono text-red-500"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Function Hex</Label>
          <Input
            value={toHex(functionHex || "")}
            onChange={handleHexChange("function")}
            disabled={!editing}
            className="font-mono text-green-500"
          />
        </div>

        {argsHex?.map((arg, index) => (
          <div key={index}>
            <Label className="text-sm font-medium">
              Argument {index + 1} Hex
            </Label>
            <Input
              value={toHex(arg)}
              onChange={handleHexChange("args", index)}
              disabled={!editing}
              className="font-mono text-blue-500"
            />
          </div>
        ))}

        <div>
          <Label className="text-sm font-medium">Encoded Call Data</Label>
          {editing ? (
            <Textarea
              value={toHex(encodedCallData || "")}
              onChange={handleEncodedCallDataChange}
              className="font-mono"
            />
          ) : (
            renderColorCodedCallData()
          )}
        </div>

        <div>
          <Label className="text-sm font-medium">Encoded Call Hash</Label>
          <Input
            value={toHex(encodedCallHash || "")}
            disabled
            className="font-mono"
          />
        </div>
      </div>
    </div>
  );
};

export default InformationPane;
