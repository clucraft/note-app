import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface FindReplaceOptions {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  highlightClass: string;
  currentClass: string;
}

export interface FindReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  results: { from: number; to: number }[];
  currentIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const findReplacePluginKey = new PluginKey('findReplace');

export const FindReplaceExtension = Extension.create<FindReplaceOptions, FindReplaceStorage>({
  name: 'findReplace',

  addOptions() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      highlightClass: 'find-highlight',
      currentClass: 'find-highlight-current',
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      results: [],
      currentIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          this.storage.searchTerm = searchTerm;
          this.storage.currentIndex = 0;
          // Force view update
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        () => {
          this.storage.replaceTerm = replaceTerm;
          return true;
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          this.storage.caseSensitive = caseSensitive;
          this.storage.currentIndex = 0;
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      findNext:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage;
          if (results.length === 0) return false;

          const nextIndex = (currentIndex + 1) % results.length;
          this.storage.currentIndex = nextIndex;

          // Scroll to result
          const result = results[nextIndex];
          if (result) {
            editor.commands.setTextSelection(result.from);
            const element = editor.view.domAtPos(result.from).node as HTMLElement;
            element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          }

          editor.view.dispatch(editor.state.tr);
          return true;
        },

      findPrevious:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage;
          if (results.length === 0) return false;

          const prevIndex = currentIndex === 0 ? results.length - 1 : currentIndex - 1;
          this.storage.currentIndex = prevIndex;

          // Scroll to result
          const result = results[prevIndex];
          if (result) {
            editor.commands.setTextSelection(result.from);
            const element = editor.view.domAtPos(result.from).node as HTMLElement;
            element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          }

          editor.view.dispatch(editor.state.tr);
          return true;
        },

      replaceCurrent:
        () =>
        ({ editor, tr }) => {
          const { results, currentIndex, replaceTerm } = this.storage;
          if (results.length === 0) return false;

          const result = results[currentIndex];
          if (!result) return false;

          tr.insertText(replaceTerm, result.from, result.to);
          editor.view.dispatch(tr);

          // Re-search after replace
          setTimeout(() => {
            editor.view.dispatch(editor.state.tr);
          }, 0);

          return true;
        },

      replaceAll:
        () =>
        ({ editor }) => {
          const { results, replaceTerm } = this.storage;
          if (results.length === 0) return false;

          // Replace from end to start to maintain positions
          const tr = editor.state.tr;
          const sortedResults = [...results].sort((a, b) => b.from - a.from);

          for (const result of sortedResults) {
            tr.insertText(replaceTerm, result.from, result.to);
          }

          editor.view.dispatch(tr);

          // Clear results after replace all
          this.storage.results = [];
          this.storage.currentIndex = 0;

          return true;
        },

      clearSearch:
        () =>
        ({ editor }) => {
          this.storage.searchTerm = '';
          this.storage.replaceTerm = '';
          this.storage.results = [];
          this.storage.currentIndex = 0;
          editor.view.dispatch(editor.state.tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { highlightClass, currentClass } = this.options;
    const storage = this.storage;

    return [
      new Plugin({
        key: findReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply: (tr, _oldState) => {
            const { searchTerm, caseSensitive } = storage;

            if (!searchTerm || searchTerm.length === 0) {
              storage.results = [];
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];
            const results: { from: number; to: number }[] = [];
            const doc = tr.doc;
            const search = caseSensitive ? searchTerm : searchTerm.toLowerCase();

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const text = caseSensitive ? node.text : node.text.toLowerCase();
              let index = 0;

              while ((index = text.indexOf(search, index)) !== -1) {
                const from = pos + index;
                const to = from + searchTerm.length;
                results.push({ from, to });
                index += searchTerm.length;
              }
            });

            storage.results = results;

            // Adjust current index if out of bounds
            if (storage.currentIndex >= results.length) {
              storage.currentIndex = Math.max(0, results.length - 1);
            }

            results.forEach((result, i) => {
              const isCurrentResult = i === storage.currentIndex;
              decorations.push(
                Decoration.inline(result.from, result.to, {
                  class: isCurrentResult ? `${highlightClass} ${currentClass}` : highlightClass,
                })
              );
            });

            return DecorationSet.create(doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
