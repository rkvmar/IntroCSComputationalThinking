# Door System Documentation

## Overview

The Door system allows you to create programmable doors in the grid that can be opened or closed based on custom logic. Players can click on doors to program them with simple if-else statements.

## Door Object Structure

```typescript
interface Door {
  type: 'door';
  id: string;              // Unique identifier for the door
  defaultCode: string[];   // Default commands for the door
  currentCode: string[];   // Current programmed commands
  editable: boolean;       // Whether players can edit the door's code
  isOpen?: boolean;        // Optional: current state (calculated dynamically)
}
```

## How to Add Doors to Levels

Replace a number in your grid contents with a Door object:

```typescript
{
  title: 'Door Challenge',
  contents: [
    [0, 0, 0, 0, 0],
    [0, 0, 2, 0, 0],  // Goal position
    [0, 0, {
      type: 'door',
      id: 'door1',
      defaultCode: ['close'],     // Door starts closed
      currentCode: ['close'],
      editable: true,
      isOpen: false
    }, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0]   // Player start position
  ],
  allowedCommands: ['f', 'r', 'l'],
  maxBlocks: 3
}
```

## Door Programming Commands

### Actions
- `open` - Opens the door
- `close` - Closes the door

### Conditions
- `if player near` - Executes if player is adjacent to the door
- `if always` - Always executes (always true)

### Control Flow
- `else` - Executes if the previous condition was false
- `end` - Ends an if-block

## Example Door Programs

### Simple Auto-Opening Door
```
if player near
open
else
close
end
```

### Always Open Door
```
if always
open
end
```

### Always Closed Door
```
close
```

## Door Logic Execution

1. **Default Behavior**: If no code is specified, the door is open by default
2. **Code Execution**: Commands are executed sequentially
3. **Condition Checking**: 
   - `if player near` checks if player is within 1 tile of the door
   - `if always` is always true
4. **Movement Blocking**: If door logic returns false, the player cannot move through the door

## Visual Indicators

- 🚪 - Closed door (brown background)
- 🔓 - Open door (green tinted, slightly larger)
- Hover effect shows the door is interactive

## Game Integration

- Click on any door to open the programming interface
- Doors reset to their default code when the level is reset
- Door state is recalculated every time the player attempts to move through it

## Best Practices

1. **Start Simple**: Begin with basic open/close logic
2. **Clear Objectives**: Make it obvious what players need to program
3. **Visual Feedback**: Use the door icons to show current state
4. **Progressive Complexity**: Introduce more complex conditions gradually
5. **Default Behavior**: Set sensible default codes that guide players