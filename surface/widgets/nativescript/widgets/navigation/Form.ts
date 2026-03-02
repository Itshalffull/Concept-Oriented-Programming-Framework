// ============================================================
// Clef Surface NativeScript Widget — Form
//
// Form container with sections for NativeScript. Organises
// input fields into named sections, each with an optional
// title and description. Provides submit/reset actions at
// the bottom of the form.
// ============================================================

import {
  StackLayout,
  ScrollView,
  Label,
  Button,
  Color,
} from '@nativescript/core';

// --------------- Types ---------------

export interface FormSection {
  title?: string;
  description?: string;
}

// --------------- Props ---------------

export interface FormProps {
  title?: string;
  description?: string;
  sections?: FormSection[];
  submitLabel?: string;
  resetLabel?: string;
  onSubmit?: () => void;
  onReset?: () => void;
  scrollable?: boolean;
  backgroundColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  sectionTitleColor?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  resetButtonColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  sectionGap?: number;
}

// --------------- Component ---------------

export function createForm(props: FormProps = {}): StackLayout {
  const {
    title = '',
    description = '',
    sections = [],
    submitLabel = 'Submit',
    resetLabel = 'Reset',
    onSubmit,
    onReset,
    scrollable = true,
    backgroundColor = '#FFFFFF',
    titleColor = '#111827',
    descriptionColor = '#6B7280',
    sectionTitleColor = '#374151',
    buttonBackgroundColor = '#2563EB',
    buttonTextColor = '#FFFFFF',
    resetButtonColor = '#6B7280',
    borderColor = '#E5E7EB',
    borderRadius = 8,
    padding = 16,
    sectionGap = 20,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-form';
  container.backgroundColor = new Color(backgroundColor);

  const formContent = new StackLayout();
  formContent.className = 'clef-form-content';
  formContent.padding = padding;

  // Form header
  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-form-title';
    titleLabel.color = new Color(titleColor);
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 20;
    titleLabel.marginBottom = 4;
    formContent.addChild(titleLabel);
  }

  if (description) {
    const descLabel = new Label();
    descLabel.text = description;
    descLabel.className = 'clef-form-description';
    descLabel.color = new Color(descriptionColor);
    descLabel.fontSize = 14;
    descLabel.textWrap = true;
    descLabel.marginBottom = sectionGap;
    formContent.addChild(descLabel);
  }

  // Sections
  sections.forEach((section, index) => {
    const sectionContainer = new StackLayout();
    sectionContainer.className = 'clef-form-section';
    sectionContainer.marginBottom = index < sections.length - 1 ? sectionGap : 0;
    sectionContainer.borderBottomWidth = index < sections.length - 1 ? 1 : 0;
    sectionContainer.borderColor = new Color(borderColor);
    sectionContainer.paddingBottom = index < sections.length - 1 ? sectionGap : 0;

    if (section.title) {
      const sectionTitle = new Label();
      sectionTitle.text = section.title;
      sectionTitle.className = 'clef-form-section-title';
      sectionTitle.color = new Color(sectionTitleColor);
      sectionTitle.fontWeight = 'bold';
      sectionTitle.fontSize = 16;
      sectionTitle.marginBottom = 4;
      sectionContainer.addChild(sectionTitle);
    }

    if (section.description) {
      const sectionDesc = new Label();
      sectionDesc.text = section.description;
      sectionDesc.className = 'clef-form-section-description';
      sectionDesc.color = new Color(descriptionColor);
      sectionDesc.fontSize = 13;
      sectionDesc.textWrap = true;
      sectionDesc.marginBottom = 12;
      sectionContainer.addChild(sectionDesc);
    }

    // Placeholder for child fields
    const fieldsContainer = new StackLayout();
    fieldsContainer.className = 'clef-form-fields';
    sectionContainer.addChild(fieldsContainer);

    formContent.addChild(sectionContainer);
  });

  // Actions row
  const actionsRow = new StackLayout();
  actionsRow.className = 'clef-form-actions';
  actionsRow.marginTop = sectionGap;
  actionsRow.orientation = 'horizontal';

  const submitButton = new Button();
  submitButton.text = submitLabel;
  submitButton.className = 'clef-form-submit';
  submitButton.backgroundColor = new Color(buttonBackgroundColor);
  submitButton.color = new Color(buttonTextColor);
  submitButton.borderRadius = borderRadius;
  submitButton.fontSize = 15;
  submitButton.fontWeight = 'bold';
  submitButton.padding = 12;
  submitButton.marginRight = 8;
  if (onSubmit) submitButton.on('tap', onSubmit);
  actionsRow.addChild(submitButton);

  if (onReset) {
    const resetButton = new Button();
    resetButton.text = resetLabel;
    resetButton.className = 'clef-form-reset';
    resetButton.backgroundColor = new Color('transparent');
    resetButton.color = new Color(resetButtonColor);
    resetButton.borderRadius = borderRadius;
    resetButton.fontSize = 15;
    resetButton.padding = 12;
    resetButton.on('tap', onReset);
    actionsRow.addChild(resetButton);
  }

  formContent.addChild(actionsRow);

  if (scrollable) {
    const scrollView = new ScrollView();
    scrollView.className = 'clef-form-scroll';
    scrollView.content = formContent;
    container.addChild(scrollView);
  } else {
    container.addChild(formContent);
  }

  return container;
}

createForm.displayName = 'Form';
export default createForm;
