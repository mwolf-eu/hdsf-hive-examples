let examples = [
  "area",
  "binhex",
  "boxplot",
  "circles",
  "contour",
  "Core_I",
  "Core_II",
  "Core_III",
  "errorbar",
  "exportSVG",
  "graph",
  "groupstack",
  "icicle",
  "jitter",
  "line",
  "map",
  "pubsub",
  "radial",
  "sankey",
  "stack",
  "starburst",
  "tbar",
  "threeCSS3dRenderer",
  "violin",
];

examples.forEach((item, i) => {
  document.getElementById("ex-table").innerHTML += `
    <tr>
      <br><br>
      <b>${item[0].toUpperCase() + item.slice(1)}</b><br>
      <a href="examples/${item}.html"><img width="50%" src="img/${item.toLowerCase()}.png"><a>
    </tr>
  `;
});
