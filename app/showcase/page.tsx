"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlusIcon, TrashIcon, MoreVerticalIcon } from "@/lib/icons"
import { ThemeSwitcher } from "@/components/kibo-ui/theme-switcher"
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CircleCheckIcon, AlertWarningIcon } from "@/lib/icons"
import { SpeechInput } from "@/components/ui/speech-input"
import { VoiceWaveform } from "@/components/ui/voice-waveform"
import { Navbar } from "@/components/ui/navbar"
import { TopNavbar } from "@/components/ui/top-navbar"
import { HeartsDisplay } from "@/components/game"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { useState } from "react"

export default function ShowcasePage() {
  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    const root = document.documentElement

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.remove("light", "dark")
      root.classList.add(systemTheme)
    } else {
      root.classList.remove("light", "dark")
      root.classList.add(theme)
    }
  }

  return (
    <div className="container mx-auto p-8 space-y-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Component Showcase</h1>
          <p className="text-muted-foreground">
            All component variants with increased padding, Poppins font, and custom styling
          </p>
        </div>
        <ThemeSwitcher onChange={handleThemeChange} defaultValue="system" />
      </div>

      {/* Buttons Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Buttons</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="destructive">Destructive Button</Button>
              <Button variant="link">Link Button</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Icons</h3>
            <div className="flex flex-wrap gap-3">
              <Button>
                <PlusIcon data-icon="inline-start" />
                Add Item
              </Button>
              <Button variant="destructive">
                <TrashIcon data-icon="inline-start" />
                Delete
              </Button>
              <Button variant="outline">
                Save
                <PlusIcon data-icon="inline-end" />
              </Button>
              <Button size="icon-xs" variant="secondary">
                <PlusIcon />
              </Button>
              <Button size="icon-sm" variant="ghost">
                <PlusIcon />
              </Button>
              <Button size="icon">
                <PlusIcon />
              </Button>
              <Button size="icon-lg" variant="outline">
                <PlusIcon />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">States</h3>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled Button</Button>
              <Button variant="outline" disabled>Disabled Outline</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Inputs Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Form Elements</h2>

        <div className="space-y-4 max-w-md">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input</h3>
            <Input placeholder="Enter text here..." />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input (disabled)</h3>
            <Input placeholder="Disabled input" disabled />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input (error state)</h3>
            <div className="space-y-2">
              <Input placeholder="Enter your email..." aria-invalid="true" />
              <p className="text-destructive text-sm">This field is required</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Textarea</h3>
            <Textarea placeholder="Enter longer text here..." />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Textarea (error state)</h3>
            <div className="space-y-2">
              <Textarea placeholder="Enter your message..." aria-invalid="true" />
              <p className="text-destructive text-sm">Message must be at least 10 characters</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Select</h3>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                  <SelectItem value="option4">Option 4</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Select (error state)</h3>
            <div className="space-y-2">
              <Select>
                <SelectTrigger aria-invalid="true">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="ca">Canada</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-destructive text-sm">Please select a country</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Select (small)</h3>
            <Select>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Small select" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input Group</h3>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput placeholder="0.00" />
            </InputGroup>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input Group (error state)</h3>
            <div className="space-y-2">
              <InputGroup aria-invalid="true">
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput placeholder="0.00" />
              </InputGroup>
              <p className="text-destructive text-sm">Amount must be greater than 0</p>
            </div>
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge>Default Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </section>

      {/* Cards Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Cards</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description goes here</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">This is the card content area with increased padding.</p>
            </CardContent>
            <CardFooter>
              <Button>Action</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>With Form</CardTitle>
              <CardDescription>Form elements inside a card</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Name" />
              <Input placeholder="Email" type="email" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button>Submit</Button>
              <Button variant="outline">Cancel</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interactive Card</CardTitle>
              <CardDescription>Hover and focus to see states</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">Click the button to test focus rings</p>
              <Button variant="destructive" className="w-full">
                <TrashIcon data-icon="inline-start" />
                Delete Item
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Alert Dialog Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Alert Dialogs</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Default Size</h3>
            <div className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Delete Account</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Small Size</h3>
            <div className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>Confirm Action</Button>
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to proceed?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Icon (Success)</h3>
            <div className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary">Show Success</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <CircleCheckIcon className="text-green-600" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Success!</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your changes have been saved successfully.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction>Close</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Icon (Warning)</h3>
            <div className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Show Warning</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <AlertWarningIcon className="text-destructive" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Warning</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action requires your attention. Please review carefully before proceeding.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">I Understand</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Button Variants</h3>
            <div className="flex flex-wrap gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost">Secondary Action</Button>
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Secondary Action</AlertDialogTitle>
                    <AlertDialogDescription>
                      This dialog uses secondary button styling.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel variant="ghost">Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="secondary">Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </section>

      {/* Dropdown Menu Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Dropdown Menu</h2>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVerticalIcon data-icon="inline-start" />
                Open Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Help</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {/* Focus Ring Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Focus Ring Demo</h2>
        <p className="text-sm text-muted-foreground">
          Press Tab to navigate through elements and see the blue focus rings (2px solid with 2px offset)
        </p>
        <div className="flex flex-wrap gap-3">
          <Button>Focus Me 1</Button>
          <Button variant="outline">Focus Me 2</Button>
          <Input placeholder="Focus me too" className="max-w-xs" />
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tab here" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Option 1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Avatar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Avatars</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Sizes</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar size="sm">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Fallback</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>CD</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Badge</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
                <AvatarBadge />
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
                <AvatarBadge />
              </Avatar>
            </div>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Progress</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 25%</h3>
            <Progress value={25} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 50%</h3>
            <Progress value={50} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 75%</h3>
            <Progress value={75} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 100%</h3>
            <Progress value={100} />
          </div>
        </div>
      </section>

      {/* Hearts Display Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Hearts Display</h2>
        <p className="text-sm text-muted-foreground">
          Game component showing remaining lives. Includes shake + fade animation when hearts are lost.
        </p>
        <HeartsDisplayDemo />
      </section>

      {/* Tabs Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Tabs</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Default Variant</h3>
            <Tabs defaultValue="account">
              <TabsList>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="account" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account settings and preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">Update your account information here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="password" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>Change your password here</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">Update your password to keep your account secure.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="settings" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>Configure your preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">Customize your experience with various settings.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Line Variant</h3>
            <Tabs defaultValue="overview">
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <p className="text-sm text-muted-foreground">View your overview dashboard here.</p>
              </TabsContent>
              <TabsContent value="analytics" className="mt-4">
                <p className="text-sm text-muted-foreground">View your analytics data here.</p>
              </TabsContent>
              <TabsContent value="reports" className="mt-4">
                <p className="text-sm text-muted-foreground">View your reports here.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Combobox Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Combobox with Chips</h2>
        <div className="grid gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Multi-Select with Chips (Normal State)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Select multiple items to see chips appear. Features:
              <br />• Blue focus ring around entire container when focused
              <br />• Chips with remove buttons (X icon)
              <br />• Click items to add/remove from selection
            </p>
            <ComboboxNormalDemo />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Error State (aria-invalid=&quot;true&quot;)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              When <code className="bg-muted px-1 py-0.5 rounded text-xs">aria-invalid=&quot;true&quot;</code> is set on ComboboxChips:
              <br />• Red destructive border and focus ring
              <br />• Same multi-select functionality with chips
            </p>
            <ComboboxErrorDemo />
          </div>
        </div>
      </section>

      {/* Voice Waveform Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Voice Waveform</h2>
        <p className="text-sm text-muted-foreground">
          Audio visualizer that reacts to microphone input. Shows inactive state when not recording.
        </p>
        <VoiceWaveformDemo />
      </section>

      {/* Speech Input Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Speech Input</h2>
        <p className="text-sm text-muted-foreground">
          Voice input component for spelling bee / word practice. Click buttons to see different states.
        </p>
        <SpeechInputDemo />
      </section>

      {/* Navbar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Navbar</h2>
        <p className="text-sm text-muted-foreground">
          Responsive navigation bar with desktop and mobile views. Supports logged-in and logged-out states.
        </p>
        <NavbarDemo />
      </section>

      {/* Top Navbar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Top Navbar</h2>
        <p className="text-sm text-muted-foreground">
          Minimal contextual header for wizard-like flows with close button and skip link.
        </p>
        <TopNavbarDemo />
      </section>

      {/* Typography Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Typography (Poppins Font)</h2>
        <div className="space-y-2">
          <p className="text-sm font-normal">Font Weight 400 (Normal) - The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm font-medium">Font Weight 500 (Medium) - The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm font-semibold">Font Weight 600 (Semibold) - The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm font-bold">Font Weight 700 (Bold) - The quick brown fox jumps over the lazy dog</p>
        </div>
      </section>
    </div>
  )
}

function ComboboxNormalDemo() {
  const anchor = useComboboxAnchor()
  const [selectedItems, setSelectedItems] = useState<string[]>(["React", "TypeScript"])

  return (
    <Combobox
      items={["React", "Vue", "Angular", "Svelte", "TypeScript", "JavaScript"]}
      multiple
      value={selectedItems}
      onValueChange={(details) => setSelectedItems(Array.from(details.values()))}
    >
      <ComboboxChips ref={anchor}>
        {selectedItems.map((item) => (
          <ComboboxChip key={item}>
            {item}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput placeholder="Select frameworks..." />
      </ComboboxChips>
      <ComboboxContent anchor={anchor.current}>
        <ComboboxEmpty>No results found</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function ComboboxErrorDemo() {
  const anchor = useComboboxAnchor()
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  return (
    <div className="space-y-2">
      <Combobox
        items={["React", "Vue", "Angular", "Svelte", "TypeScript", "JavaScript"]}
        multiple
        value={selectedItems}
        onValueChange={(details) => setSelectedItems(Array.from(details.values()))}
      >
        <ComboboxChips ref={anchor} aria-invalid="true">
          {selectedItems.map((item) => (
            <ComboboxChip key={item}>
              {item}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder="Select at least one framework..." />
        </ComboboxChips>
        <ComboboxContent anchor={anchor.current}>
          <ComboboxEmpty>No results found</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="text-destructive text-sm">Please select at least one framework</p>
    </div>
  )
}

function VoiceWaveformDemo() {
  const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder({
    onTranscript: (text) => console.log("Transcript:", text),
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Interactive Demo</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Click Record to capture microphone input. The waveform reacts to your voice.
        </p>
        <div className="flex flex-col items-start gap-4">
          <VoiceWaveform analyserNode={analyserNode} />
          <div className="flex items-center gap-4">
            <Button
              variant={isRecording ? "destructive" : "default"}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
            {transcript && (
              <p className="text-sm text-muted-foreground">
                You said: <span className="text-foreground font-medium">&quot;{transcript}&quot;</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Inactive State</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Minimal uniform bars when no audio input.
        </p>
        <VoiceWaveform />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Full Integration with SpeechInput</h3>
        <p className="text-sm text-muted-foreground mb-3">
          VoiceWaveform positioned above SpeechInput with gap-6, as per the Figma design.
        </p>
        <VoiceWaveformWithSpeechInputDemo />
      </div>
    </div>
  )
}

function VoiceWaveformWithSpeechInputDemo() {
  const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder()
  const [playPressed, setPlayPressed] = useState(false)
  const [dictionaryPressed, setDictionaryPressed] = useState(false)
  const [sentencePressed, setSentencePressed] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6 max-w-[525px]">
      <VoiceWaveform analyserNode={analyserNode} />
      <SpeechInput
        state={isRecording ? "recording" : "default"}
        playPressed={playPressed}
        dictionaryPressed={dictionaryPressed}
        sentencePressed={sentencePressed}
        inputText={transcript}
        onRecordClick={startRecording}
        onStopClick={stopRecording}
        onPlayClick={() => setPlayPressed(!playPressed)}
        onDictionaryClick={() => {
          setDictionaryPressed(!dictionaryPressed)
          setPlayPressed(false)
          setSentencePressed(false)
        }}
        onSentenceClick={() => {
          setSentencePressed(!sentencePressed)
          setPlayPressed(false)
          setDictionaryPressed(false)
        }}
        definition="Definition: a male child or young man"
      />
    </div>
  )
}

function SpeechInputDemo() {
  const [state, setState] = useState<"default" | "recording">("default")
  const [playPressed, setPlayPressed] = useState(false)
  const [dictionaryPressed, setDictionaryPressed] = useState(false)
  const [sentencePressed, setSentencePressed] = useState(false)
  const [inputText, setInputText] = useState("")

  const handleRecord = () => {
    setState("recording")
    // Simulate voice input after 2 seconds
    setTimeout(() => {
      setInputText("boy")
    }, 1000)
  }

  const handleStop = () => {
    setState("default")
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Interactive Demo</h3>
        <SpeechInput
          state={state}
          playPressed={playPressed}
          dictionaryPressed={dictionaryPressed}
          sentencePressed={sentencePressed}
          inputText={inputText}
          onRecordClick={handleRecord}
          onStopClick={handleStop}
          onPlayClick={() => setPlayPressed(!playPressed)}
          onDictionaryClick={() => {
            setDictionaryPressed(!dictionaryPressed)
            setPlayPressed(false)
            setSentencePressed(false)
          }}
          onSentenceClick={() => {
            setSentencePressed(!sentencePressed)
            setPlayPressed(false)
            setDictionaryPressed(false)
          }}
          definition="Definition: a male child or young man"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Default State (No Input)</h3>
        <SpeechInput />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Recording State</h3>
        <SpeechInput state="recording" />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Input + Dictionary</h3>
        <SpeechInput
          inputText="elephant"
          dictionaryPressed={true}
          definition="Definition: a very large animal with thick grey skin, large ears, two curved outer teeth called tusks and a long nose called a trunk"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Recording + Play Active</h3>
        <SpeechInput
          state="recording"
          inputText="magnificent"
          playPressed={true}
        />
      </div>
    </div>
  )
}

function NavbarDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Logged Out (Default)</h3>
        <Navbar
          logo={
            <div className="size-9 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-sm">
              L
            </div>
          }
          onSignUp={() => alert("Sign up clicked")}
          onNotificationClick={() => alert("Notifications clicked")}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Logged In (with notifications)</h3>
        <Navbar
          logo={
            <div className="size-9 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-sm">
              L
            </div>
          }
          isLoggedIn={true}
          user={{
            name: "John Doe",
            email: "john@example.com",
            avatarUrl: "https://github.com/shadcn.png",
            initials: "JD",
          }}
          notificationCount={2}
          onNotificationClick={() => alert("Notifications clicked")}
          onProfileClick={() => alert("Profile clicked")}
          onSettingsClick={() => alert("Settings clicked")}
          onSignOut={() => alert("Sign out clicked")}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Custom Nav Links</h3>
        <Navbar
          logo={
            <div className="size-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              P
            </div>
          }
          navLinks={[
            { label: "Home", href: "/", active: true },
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/settings" },
          ]}
          onSignUp={() => alert("Sign up clicked")}
        />
      </div>

      <div className="relative">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Mobile View (resize browser or use dev tools)</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The navbar shows a hamburger menu on mobile. Click the menu icon to expand. Below is a mobile-width preview:
        </p>
        <div className="max-w-[375px]">
          <Navbar
            logo={
              <div className="size-9 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-sm">
                L
              </div>
            }
            isLoggedIn={true}
            user={{
              name: "Jane Smith",
              email: "jane@example.com",
              initials: "JS",
            }}
            notificationCount={5}
            onNotificationClick={() => alert("Notifications clicked")}
            onProfileClick={() => alert("Profile clicked")}
            onSettingsClick={() => alert("Settings clicked")}
            onSignOut={() => alert("Sign out clicked")}
          />
        </div>
      </div>
    </div>
  )
}

function TopNavbarDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Default (with callback)</h3>
        <TopNavbar
          onClose={() => alert("Close clicked")}
          skipHref="/dashboard"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Close Link</h3>
        <TopNavbar
          closeHref="/"
          skipHref="/skip"
          skipLabel="Skip this step"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Without Skip Link</h3>
        <TopNavbar
          onClose={() => alert("Close clicked")}
          hideSkip
        />
      </div>
    </div>
  )
}

function HeartsDisplayDemo() {
  const [hearts, setHearts] = useState(3)

  const loseHeart = () => {
    if (hearts > 0) {
      setHearts(hearts - 1)
    }
  }

  const resetHearts = () => {
    setHearts(3)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Interactive Demo</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Click &quot;Lose Heart&quot; to see the shake + fade animation. Lost hearts remain visible at 50% opacity (disabled state).
        </p>
        <div className="flex items-center gap-6">
          <HeartsDisplay remaining={hearts} onHeartLost={() => console.log("Heart lost!")} />
          <div className="flex gap-2">
            <Button variant="destructive" onClick={loseHeart} disabled={hearts === 0}>
              Lose Heart
            </Button>
            <Button variant="outline" onClick={resetHearts}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">All States (Active/Disabled Pattern)</h3>
        <p className="text-sm text-muted-foreground mb-3">
          All 3 hearts are always visible. Filled hearts are full opacity, lost hearts are 50% opacity (like a disabled destructive button).
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-32">3 filled, 0 lost:</span>
            <HeartsDisplay remaining={3} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-32">2 filled, 1 lost:</span>
            <HeartsDisplay remaining={2} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-32">1 filled, 2 lost:</span>
            <HeartsDisplay remaining={1} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-32">0 filled, 3 lost:</span>
            <HeartsDisplay remaining={0} />
            <span className="text-sm text-muted-foreground">(game over)</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Accessibility</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The component includes <code className="bg-muted px-1 py-0.5 rounded text-xs">aria-live=&quot;polite&quot;</code> and <code className="bg-muted px-1 py-0.5 rounded text-xs">aria-label</code> for screen reader support.
          Animation respects <code className="bg-muted px-1 py-0.5 rounded text-xs">prefers-reduced-motion</code>.
        </p>
      </div>
    </div>
  )
}
