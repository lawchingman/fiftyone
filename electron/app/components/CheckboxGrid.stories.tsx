import React, { useState } from "react";
import CheckboxGrid from "./CheckboxGrid";
import { Box } from "./utils";
import { withKnobs, boolean } from "@storybook/addon-knobs";

export default {
  component: CheckboxGrid,
  title: "CheckboxGrid",
  decorators: [withKnobs],
};

const entries = [
  { name: "Test", data: 100 },
  { name: "Train", data: 300 },
  { name: "Processed", data: 200 },
  { name: "Reviewed", data: 150 },
];

const StatefulCheckboxGrid = (props) => {
  const [selected, setSelected] = useState({});
  return (
    <CheckboxGrid
      entries={props.entries.map((e) => ({
        ...e,
        selected: Boolean(selected[e.name]),
      }))}
      onCheck={(e) => setSelected({ ...selected, [e.name]: !selected[e.name] })}
    />
  );
};

export const standard = () => <StatefulCheckboxGrid entries={entries} />;

export const contained = () => (
  <Box style={{ width: 300 }}>
    <StatefulCheckboxGrid entries={entries} />
  </Box>
);

export const colors = () => (
  <Box style={{ width: 300 }}>
    <StatefulCheckboxGrid
      entries={["Red", "Yellow", "Green", "Blue"].map((c) => ({
        name: c,
        color: c.toLowerCase(),
      }))}
    />
  </Box>
);
