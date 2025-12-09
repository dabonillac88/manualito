import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const renderLine = (line: string, index: number) => {
    // Bold
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Links (simple for this context)
    line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');

    return <span dangerouslySetInnerHTML={{ __html: line }} key={index} />;
  };

  // Fix: Refactor `parseMarkdown` to correctly handle ordered and unordered lists
  // by accumulating list items before rendering the complete list element,
  // resolving JSX syntax errors related to incomplete tags.
  const parseMarkdown = (markdownText: string) => {
    // Fix: Use React.ReactNode[] for elements to avoid 'Cannot find namespace JSX' error.
    const lines = markdownText.split('\n');
    const elements: React.ReactNode[] = [];
    let currentListItems: React.ReactNode[] = [];
    let currentListType: 'ul' | 'ol' | null = null;

    const closeCurrentList = (index: number) => {
      if (currentListType === 'ul') {
        elements.push(<ul key={`ul-${index}`} className="list-disc list-inside ml-4">{currentListItems}</ul>);
      } else if (currentListType === 'ol') {
        elements.push(<ol key={`ol-${index}`} className="list-decimal list-inside ml-4">{currentListItems}</ol>);
      }
      currentListItems = [];
      currentListType = null;
    };

    lines.forEach((line, index) => {
      // Check for headings
      if (line.startsWith('## ')) {
        closeCurrentList(index); // Close any active list before a heading
        elements.push(<h2 key={`h2-${index}`} className="text-xl font-semibold mt-4 mb-2">{renderLine(line.substring(3), 0)}</h2>);
      } else if (line.startsWith('### ')) {
        closeCurrentList(index); // Close any active list before a heading
        elements.push(<h3 key={`h3-${index}`} className="text-lg font-semibold mt-3 mb-1">{renderLine(line.substring(4), 0)}</h3>);
      }
      // Check for unordered lists
      else if (line.startsWith('* ') || line.startsWith('- ')) {
        if (currentListType !== 'ul') {
          closeCurrentList(index); // Close previous list if type changes or new list starts
          currentListType = 'ul';
        }
        currentListItems.push(<li key={`li-${index}-${currentListItems.length}`}>{renderLine(line.substring(2), 0)}</li>);
      }
      // Check for ordered lists
      else if (line.match(/^\d+\.\s/)) {
        if (currentListType !== 'ol') {
          closeCurrentList(index); // Close previous list if type changes or new list starts
          currentListType = 'ol';
        }
        currentListItems.push(<li key={`li-${index}-${currentListItems.length}`}>{renderLine(line.substring(line.indexOf('.') + 1).trim(), 0)}</li>);
      }
      else {
        closeCurrentList(index); // Close any active list if the current line is not a list item
        if (line.trim() !== '') {
          elements.push(<p key={`p-${index}`} className="mb-1">{renderLine(line, 0)}</p>);
        } else {
          elements.push(<br key={`br-${index}`} />);
        }
      }
    });

    closeCurrentList(lines.length); // Close any remaining open list at the end of the content

    return elements;
  };

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
};

export default MarkdownRenderer;