const icons = import.meta.glob("./*.png", {
    eager: true,
    import: "default",
    query: "?url",
}) as Record<string, string>;

export default icons;
